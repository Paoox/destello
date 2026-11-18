/**
 * Destello API — El WhatsApp de "tu pago quedó confirmado" (T-48)
 *
 * Es lo ÚNICO que recibe la persona por WhatsApp al confirmar su pago:
 * confirmación + bienvenida a SU taller (nombre, fecha, horario) + cómo
 * entrar. **Sin datos de pago** — ya pagó; volver a mandarle la CLABE la
 * confunde ("¿tengo que pagar otra vez?"). Ver T-48 en docs/backlog-tickets.md.
 *
 * Función pura (sin BD ni red) para poder probarla sola.
 */

const DIAS  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
               'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

/**
 * "2026-11-30" → "domingo 30 de noviembre".
 *
 * Recibe el texto 'YYYY-MM-DD' (la consulta usa `to_char`), NUNCA un `Date`
 * de pg: con un Date, la medianoche en UTC se vuelve el día anterior en CDMX
 * — el mismo bug que ya le dio a alguien la fecha equivocada de su taller
 * (migración 014). Aquí no hay zona horaria que se meta.
 */
export function fechaLarga(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
    if (!m) return null
    const [, a, mes, d] = m.map(Number)
    const dia = new Date(Date.UTC(a, mes - 1, d)).getUTCDay()
    return `${DIAS[dia]} ${d} de ${MESES[mes - 1]}`
}

/**
 * @param {object} p
 * @param {string}  p.nombre   Nombre (se usa solo el primero)
 * @param {string?} p.taller   Nombre del taller
 * @param {string?} p.fecha    'YYYY-MM-DD'
 * @param {string?} p.horario  Texto libre del panel, ej. "10:00 – 12:00"
 */
export function mensajeBienvenidaPago({ nombre, taller, fecha, horario }) {
    const primerNombre = String(nombre ?? '').trim().split(/\s+/)[0] || ''
    const cuando = fechaLarga(fecha)
    return [
        '✦ *Destello*',
        '',
        `¡Hola${primerNombre ? ` ${primerNombre}` : ''}! Recibimos tu pago y quedó *confirmado*. 🎉`,
        '',
        taller ? `¡Te damos la bienvenida a *${taller}*!` : '¡Te damos la bienvenida a Destello!',
        cuando  ? `📅 ${cuando.charAt(0).toUpperCase() + cuando.slice(1)}` : null,
        horario ? `🕐 ${horario} (hora CDMX)` : null,
        '',
        'Tu taller ya te espera en la plataforma:',
        'https://destello.courses/login',
        '',
        '_Entra con Google o con tu número de WhatsApp._',
        '',
        '¡Nos vemos en clase! 🌟',
    ].filter(l => l !== null).join('\n')
}
