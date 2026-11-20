/**
 * Destello API — Textos de las notificaciones (T-44)
 *
 * Funciones puras (sin BD ni red) para poder probarlas solas. Cada tipo arma:
 *   · lo que se ve en la campanita (`titulo`, `cuerpo`, `liga`)
 *   · el WhatsApp, si ese tipo lo lleva (`mensajeWhatsapp`)
 *
 * Las fechas llegan como texto 'YYYY-MM-DD' y las horas como 'HH:MM:SS',
 * nunca como `Date` de pg (ver migración 014: un Date se corre un día en CDMX).
 */
import { fechaLarga } from './mensajeBienvenidaPago.js'

export const SITIO = 'https://destello.courses'

/** Tipos que llevan WhatsApp y tipos que llevan correo. */
export const TIPOS_WA     = new Set(['taller_24h', 'taller_1h', 'profe_24h', 'profe_1h'])
export const TIPOS_CORREO = new Set(['nuevo_taller'])

/** '17:00:00' → '5:00 PM' */
export function fmtHora(hora) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hora ?? ''))
    if (!m) return null
    const h = Number(m[1])
    return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`
}

const primerNombre = (n) => String(n ?? '').trim().split(/\s+/)[0] || ''
const mayus = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

/** 'hoy' | 'mañana' según cuántos días faltan (calculado en CDMX). */
export const cuandoTexto = (dias) => (Number(dias) <= 0 ? 'hoy' : 'mañana')

/**
 * Cómo se dice la hora: el texto del panel si existe, si no la hora de inicio.
 * Le agrega "(hora CDMX)" solo si el texto del panel no lo trae ya — había
 * talleres con "12:00 PM (CDMX)" que salían como "(CDMX) … (hora CDMX)".
 */
export function horarioDe(d) {
    const h = d.horario || fmtHora(d.horaInicio)
    if (!h) return null
    return /cdmx/i.test(h) ? h : `${h} (hora CDMX)`
}

/**
 * Lo que se ve en la campanita.
 * @returns {{ titulo: string, cuerpo: string, liga: string }}
 */
export function armarNotificacion(tipo, d = {}) {
    const taller  = d.taller || 'tu taller'
    const horario = horarioDe(d)
    const hora    = fmtHora(d.horaInicio)
    const cuando  = cuandoTexto(d.dias)

    switch (tipo) {
        case 'taller_24h':
            return {
                titulo: `Tu taller es ${cuando} ✦`,
                cuerpo: `${taller}${horario ? ` · ${horario}` : ''}. ` +
                        'La entrada al aula aparece en Inicio un poco antes de empezar.',
                liga:   '/home',
            }
        case 'taller_1h':
            return {
                titulo: 'Tu clase empieza en menos de una hora',
                cuerpo: `${taller}${hora ? ` empieza a las ${hora} (hora CDMX)` : ''}. ` +
                        'Entra desde Inicio con "Entrar a clase".',
                liga:   '/home',
            }
        case 'profe_24h':
            return {
                titulo: `${mayus(cuando)} impartes ${taller}`,
                cuerpo: [
                    horario ? `${horario}.` : null,
                    resumenAlumnas(d),
                ].filter(Boolean).join(' '),
                liga:   '/perfil',
            }
        case 'profe_1h':
            return {
                titulo: 'Tu clase empieza en menos de una hora',
                cuerpo: `${taller}${hora ? ` a las ${hora} (hora CDMX)` : ''}. ${resumenAlumnas(d)}`,
                liga:   '/perfil',
            }
        case 'nuevo_taller': {
            const f = fechaLarga(d.fecha)
            return {
                titulo: `Nuevo taller: ${taller}`,
                cuerpo: [
                    f ? `${mayus(f)}${horario ? ` · ${horario}` : ''}.` : null,
                    'Aparta tu lugar desde el Hábitat.',
                ].filter(Boolean).join(' '),
                liga:   '/habitat',
            }
        }
        case 'certificado':
            return {
                titulo: 'Tu certificado ya está listo 🎓',
                cuerpo: `Ya puedes ver y descargar tu certificado de ${taller}.`,
                liga:   d.folio ? `/certificado/${d.folio}` : '/perfil',
            }
        case 'pago_confirmado':
            return {
                titulo: 'Tu lugar quedó confirmado',
                cuerpo: `Recibimos tu pago de ${taller}. ¡Nos vemos en clase!`,
                liga:   '/home',
            }
        case 'nueva_alumna':
            return {
                titulo: `Nuevo alumno registrado en ${taller}`,
                cuerpo: `${d.alumna || 'Alguien'} confirmó su lugar. ${resumenAlumnas(d)}`,
                liga:   '/perfil',
            }
        case 'respuesta_soporte':
            return {
                titulo: [
                    'Respuesta a tu reporte',
                    d.folio ? ` ${d.folio}` : '',
                    d.asunto ? `: ${d.asunto}` : '',
                ].join('') || 'Respondimos tu reporte ✦',
                cuerpo: d.respuesta || '',
                // Lleva a la conversación en Ajustes → Soporte, donde puede contestar.
                liga:   d.reporteId ? `/settings?reporte=${d.reporteId}` : null,
            }
        default:
            return { titulo: 'Aviso de Destello', cuerpo: '', liga: '/home' }
    }
}

/** Un recordatorio de clase que ya empezó ya no sirve: no se manda tarde. */
export function yaNoSirve(n, ahora = Date.now()) {
    if (!/_(24h|1h)$/.test(n?.tipo ?? '')) return false
    const inicio = Date.parse(n.datos?.inicio)
    return Number.isFinite(inicio) && inicio <= ahora
}

/**
 * "Tienes 9 alumnos registrados." — `registrados` = SOLO los de pago
 * confirmado (chispa no demo). Decisión de Paola (19 nov 2026): a la profe no
 * se le da el detalle de pendientes/pagados; eso lo ve solo admin en Métricas.
 */
export function resumenAlumnas({ registrados } = {}) {
    if (registrados == null) return ''
    const n = Number(registrados)
    return `Tienes ${n} ${n === 1 ? 'alumno registrado' : 'alumnos registrados'}.`
}

/** El WhatsApp de los tipos que lo llevan (`null` si el tipo no lleva). */
export function mensajeWhatsapp(tipo, d = {}) {
    if (!TIPOS_WA.has(tipo)) return null
    const nombre  = primerNombre(d.nombre)
    const hola    = `¡Hola${nombre ? ` ${nombre}` : ''}! ✦`
    const taller  = d.taller || 'tu taller'
    const horario = horarioDe(d)
    const hora    = fmtHora(d.horaInicio)
    const cuando  = cuandoTexto(d.dias)

    const lineas = {
        taller_24h: [
            hola, '',
            `Te recuerdo que *${cuando}* es tu taller *${taller}*.`,
            horario ? `🕐 ${horario}` : null,
            '',
            'Entra a la plataforma un poco antes; en Inicio te aparece "Entrar a clase":',
            `${SITIO}/home`,
            '',
            '¡Nos vemos ahí! 🌟',
        ],
        taller_1h: [
            hola, '',
            `Tu taller *${taller}* empieza en menos de una hora${hora ? ` (a las ${hora}, hora CDMX)` : ''}.`,
            '',
            'Entra aquí y dale a "Entrar a clase":',
            `${SITIO}/home`,
        ],
        profe_24h: [
            hola, '',
            `*${mayus(cuando)}* impartes *${taller}*.`,
            horario ? `🕐 ${horario}` : null,
            resumenAlumnas(d) || null,
            '',
            `Tu aula de ensayo y tus talleres: ${SITIO}/perfil`,
        ],
        profe_1h: [
            hola, '',
            `Tu clase de *${taller}* empieza en menos de una hora${hora ? ` (a las ${hora}, hora CDMX)` : ''}.`,
            resumenAlumnas(d) || null,
            '',
            `${SITIO}/home`,
        ],
    }[tipo]

    return lineas.filter(l => l !== null).join('\n')
}
