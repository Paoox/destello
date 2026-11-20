/**
 * Destello API — Ajustes de la cuenta (T-45, 19 nov 2026)
 *
 *   · avisos por WhatsApp / correo (los respeta notificacionService, T-44)
 *   · cambiar el WhatsApp — SOLO con código al número nuevo (el correo no se
 *     cambia: es la llave de la cuenta, de Google y de sus chispas)
 *   · reportar un problema → cae en el panel, tab Reportes
 *   · pedir la baja (regla en la migración 022)
 */
import { query, withTransaction } from '../db/db.js'
import { AppError } from '../middleware/errorHandler.js'
import * as otp from './otpService.js'
import { sendWhatsapp } from './botService.js'
import { asegurarWhatsappLibre, normalizarWhatsapp } from './usuarioService.js'
import { crearReporte, MOTIVOS, folioReporte, reportesDePersona, mensajeDePersona, cerrarPorPersona } from './reporteService.js'
import * as bloqueoService from './bloqueoService.js'
import { subirImagenSoporte } from './storageService.js'

/** Lo que tiene que escribir para confirmar la baja. */
export const PALABRA_BAJA = 'ELIMINAR'

// ── Lectura ────────────────────────────────────────────────────────────────

export async function leer(usuarioId) {
    const { rows } = await query(
        `SELECT email, nombre, whatsapp, avisos_whatsapp, avisos_correo
           FROM usuarios WHERE id = $1`, [usuarioId])
    if (!rows.length) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND')
    return rows[0]
}

// ── Avisos ─────────────────────────────────────────────────────────────────

export async function guardarAvisos(usuarioId, { avisosWhatsapp, avisosCorreo } = {}) {
    const { rows } = await query(
        `UPDATE usuarios
            SET avisos_whatsapp = COALESCE($2, avisos_whatsapp),
                avisos_correo   = COALESCE($3, avisos_correo),
                updated_at      = NOW()
          WHERE id = $1
      RETURNING avisos_whatsapp, avisos_correo`,
        [usuarioId,
         typeof avisosWhatsapp === 'boolean' ? avisosWhatsapp : null,
         typeof avisosCorreo   === 'boolean' ? avisosCorreo   : null])
    return rows[0]
}

// ── Cambiar WhatsApp (con código) ──────────────────────────────────────────

/** Paso 1: valida el número nuevo y le manda un código por Faro. */
export async function pedirCodigoWhatsapp(usuarioId, numero) {
    const wa = normalizarWhatsapp(numero)
    if (!wa || wa.length !== 10) throw new AppError('Escribe el número a 10 dígitos', 400, 'BAD_REQUEST')

    const { rows } = await query('SELECT whatsapp FROM usuarios WHERE id = $1', [usuarioId])
    if (rows[0]?.whatsapp === wa) throw new AppError('Ese ya es tu número', 400, 'MISMO_NUMERO')

    await asegurarWhatsappLibre(wa, usuarioId)   // 409 WA_EN_USO si es de otra cuenta

    const rl = otp.canResend(wa)
    if (!rl.ok) throw new AppError(`Espera ${rl.waitSeconds}s para pedir otro código`, 429, 'RESEND_TOO_SOON')

    const code = otp.generate(wa)
    await sendWhatsapp(wa,
        `✦ *Destello*\n\n` +
        `Tu código para confirmar este número en tu cuenta es: *${code}*\n\n` +
        `Vence en 10 minutos. Si tú no lo pediste, ignora este mensaje.`)
    return { enviadoA: wa }
}

/** Paso 2: si el código del número nuevo es correcto, se guarda. */
export async function confirmarWhatsapp(usuarioId, numero, codigo) {
    const wa = normalizarWhatsapp(numero)
    if (!wa || wa.length !== 10 || !codigo) {
        throw new AppError('Faltan el número o el código', 400, 'BAD_REQUEST')
    }
    const r = otp.verify(wa, codigo)
    if (!r.ok) {
        const msgs = {
            NO_CODE:           'No hay un código activo para ese número. Pide uno nuevo.',
            EXPIRED:           'El código expiró. Pide uno nuevo.',
            TOO_MANY_ATTEMPTS: 'Demasiados intentos. Pide un código nuevo.',
            INVALID_CODE:      'Código incorrecto. Revísalo e intenta de nuevo.',
        }
        throw new AppError(msgs[r.reason] ?? 'Código inválido', 400, r.reason)
    }
    // Se revisa otra vez: en esos minutos alguien más pudo haberlo tomado.
    await asegurarWhatsappLibre(wa, usuarioId)
    const { rows } = await query(
        `UPDATE usuarios SET whatsapp = $2, updated_at = NOW() WHERE id = $1 RETURNING whatsapp`,
        [usuarioId, wa])
    return rows[0]
}

// ── Soporte ────────────────────────────────────────────────────────────────

/**
 * Opciones de "¿Qué pasó?" en Soporte. La pantalla manda la llave; aquí se
 * valida y se pone la etiqueta al inicio del reporte para que Paola vea de
 * qué se trata sin abrirlo. Mantener igual que OPCIONES_SOPORTE en PageAjustes.jsx.
 */
export const CATEGORIAS_SOPORTE = {
    acceso_taller:   'No puedo entrar a mi taller',
    material_30dias: 'Dudas con los 30 días de material del taller',
    correo_perdido:  'Perdí el acceso a mi correo electrónico',
    notificaciones:  'No me llegan las notificaciones',
    pago:            'Problema con mi pago',
    certificado:     'Problema con mi certificado',
    clase_en_vivo:   'Problema con video o audio en la clase',
    otro:            'Otro',
}

/** Arma el texto del reporte (pura, con pruebas). */
export function armarDetalleSoporte({ categoria, taller, detalle }) {
    const etiqueta = CATEGORIAS_SOPORTE[categoria]
    if (!etiqueta) return { ok: false, message: 'Elige qué pasó' }
    const texto = String(detalle ?? '').trim()
    if (texto.length < 5) return { ok: false, message: 'Cuéntanos un poco qué pasó' }
    if (texto.length > 2000) return { ok: false, message: 'El mensaje es muy largo (máximo 2000 letras)' }
    const partes = [`[${etiqueta}]`, taller ? `[${taller}]` : null, texto]
    return { ok: true, detalle: partes.filter(Boolean).join(' ') }
}

export async function reportarProblema(usuarioId, { categoria, detalle, tallerId, imagen = null } = {}) {
    const u = await leer(usuarioId)
    let taller = null
    if (tallerId) {
        const { rows } = await query('SELECT nombre FROM talleres WHERE id = $1', [tallerId])
        taller = rows[0]?.nombre ?? null
    }
    const r = armarDetalleSoporte({ categoria, taller, detalle })
    if (!r.ok) throw new AppError(r.message, 400, 'BAD_REQUEST')
    const comprobantePath = imagen ? await subirImagenSoporte(imagen) : null

    const { reporte } = await crearReporte({
        email: u.email, nombre: u.nombre, whatsapp: u.whatsapp,
        motivo: MOTIVOS.PROBLEMA,
        detalle: r.detalle,
        comprobantePath,
        permitirDuplicado: true,   // alguien puede tener dos problemas distintos
    })
    return { id: reporte.id, folio: folioReporte(reporte.id) }
}

/** "Mis reportes" en Ajustes → Soporte. */
export async function misReportes(usuarioId) {
    const u = await leer(usuarioId)
    return reportesDePersona(u.email)
}

/** La persona agrega algo a uno de SUS reportes (se reabre). */
export async function escribirEnReporte(usuarioId, reporteId, { texto, imagen } = {}) {
    const u = await leer(usuarioId)
    return mensajeDePersona(reporteId, { email: u.email, usuarioId, nombre: u.nombre, texto, imagen })
}

/** "Ya se resolvió, gracias": la persona cierra su propio reporte. */
export async function cerrarMiReporte(usuarioId, reporteId) {
    const u = await leer(usuarioId)
    return cerrarPorPersona(reporteId, u.email)
}

// ── Baja ───────────────────────────────────────────────────────────────────

/**
 * Regla pura (con pruebas): ¿se puede pedir la baja?
 * @returns {{ ok: true } | { ok: false, code: string, message: string }}
 */
export function validarBaja({ confirmacion, talleresQueImparte = 0 }) {
    if (talleresQueImparte > 0) {
        return { ok: false, code: 'ES_PROFE',
            message: 'Tienes talleres asignados como profesora. Escríbenos para dar de baja tu cuenta.' }
    }
    if (String(confirmacion ?? '').trim().toUpperCase() !== PALABRA_BAJA) {
        return { ok: false, code: 'SIN_CONFIRMAR', message: `Escribe ${PALABRA_BAJA} para confirmar.` }
    }
    return { ok: true }
}

/** Lo que la pantalla necesita mostrar antes de que confirme. */
export async function previaBaja(usuarioId) {
    const u = await leer(usuarioId)
    const { rows: [imparte] } = await query(
        'SELECT COUNT(*)::int AS n FROM taller_profesores WHERE usuario_id = $1', [usuarioId])
    const { rows: proximos } = await query(
        `SELECT DISTINCT t.id, t.nombre, to_char(t.fecha_inicio, 'YYYY-MM-DD') AS fecha
           FROM lista_espera le JOIN talleres t ON t.id = le.taller_id
          WHERE LOWER(le.email) = LOWER($1) AND le.pagado_at IS NOT NULL
            AND (t.fecha_inicio IS NULL
                 OR COALESCE(t.fecha_fin, t.fecha_inicio) >= (NOW() AT TIME ZONE 'America/Mexico_City')::date)`,
        [u.email])
    return { esProfe: imparte.n > 0, talleresPagadosProximos: proximos }
}

export async function pedirBaja(usuarioId, { confirmacion, motivo } = {}) {
    const u = await leer(usuarioId)
    const { esProfe } = await previaBaja(usuarioId)
    const v = validarBaja({ confirmacion, talleresQueImparte: esProfe ? 1 : 0 })
    if (!v.ok) throw new AppError(v.message, v.code === 'ES_PROFE' ? 409 : 400, v.code)

    const motivoLimpio = String(motivo ?? '').trim().slice(0, 500) || null

    await withTransaction(async (q) => {
        await q(
            `UPDATE usuarios
                SET baja_solicitada_at = NOW(), baja_motivo = $2,
                    avisos_whatsapp = FALSE, avisos_correo = FALSE, updated_at = NOW()
              WHERE id = $1`, [usuarioId, motivoLimpio])
        // Los lugares apartados SIN pagar se liberan: ocupan cupo real (T-36).
        await q(
            `UPDATE lista_espera
                SET estado = 'rechazado',
                    notas  = CONCAT_WS(' · ', NULLIF(notas, ''), 'Liberado: la persona pidió su baja')
              WHERE LOWER(email) = LOWER($1)
                AND pagado_at IS NULL
                AND estado IN ('pendiente', 'cupo_confirmado', 'confirmado')`, [u.email])
    })

    // Mismo interruptor que usa Paola en el tab Usuarios: corta login, bot y
    // aula, y deja su renglón en el historial de bloqueos.
    const r = await bloqueoService.cambiar({
        email: u.email, tipo: 'acceso', bloquear: true,
        motivo: `Baja pedida por la persona desde Ajustes${motivoLimpio ? `: ${motivoLimpio}` : ''}`,
        hechoPor: 'la persona (Ajustes)',
    })
    if (!r.ok) throw new AppError('No se pudo completar la baja', 500, r.reason)

    // Aviso a Paola (tab Reportes + WhatsApp). Si falla, la baja ya quedó.
    await crearReporte({
        email: u.email, nombre: u.nombre, whatsapp: u.whatsapp,
        motivo: MOTIVOS.BAJA, detalle: motivoLimpio,
    }).catch(err => console.error('[baja] no se pudo crear el reporte:', err.message))

    return { ok: true }
}
