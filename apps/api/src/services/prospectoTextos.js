/**
 * Destello API — Textos de la invitación a prospectos (pura, con pruebas).
 * La persona no necesariamente tiene acceso a la plataforma (puede que nunca
 * haya pagado), así que la invitación la lleva al WhatsApp de Faro, que es
 * por donde se inscribe.
 */
import { fechaLarga } from './mensajeBienvenidaPago.js'

export const WA_FARO = '525577888800'

/** Liga a Faro con el mensaje ya escrito. */
export function ligaInscripcion(tallerNombre) {
    return `https://wa.me/${WA_FARO}?text=${encodeURIComponent(`Hola ✦ Quiero inscribirme a ${tallerNombre}`)}`
}

/** Por qué la invitamos, en sus palabras. */
export function fraseOrigen(origen) {
    return origen === 'sin_cupo'
        ? 'La vez pasada se llenó antes de que alcanzaras lugar, así que te avisamos primero. '
        : 'Sabemos que te interesó y queríamos avisarte. '
}

export function mensajeInvitacion({ nombre, origen, taller = {} }) {
    const primer = String(nombre ?? '').trim().split(/\s+/)[0]
    const f = fechaLarga(taller.fecha)
    const precio = Number(taller.precio) > 0 ? `💰 $${Number(taller.precio).toLocaleString('es-MX')} MXN` : null
    return [
        `¡Hola${primer ? ` ${primer}` : ''}! ✦`,
        '',
        `Abrimos una nueva fecha de *${taller.nombre}*. ${fraseOrigen(origen)}`.trim(),
        '',
        f ? `📅 ${f.charAt(0).toUpperCase() + f.slice(1)}` : null,
        taller.horario ? `🕐 ${taller.horario}${/cdmx/i.test(taller.horario) ? '' : ' (hora CDMX)'}` : null,
        precio,
        '',
        'Los lugares son limitados. Si quieres apartar el tuyo, respóndenos *"Quiero inscribirme"* por aquí. 🙌',
    ].filter(l => l !== null).join('\n').replace(/\n{3,}/g, '\n\n')
}
