/**
 * Estimado de cuántos talleres da una profe esta semana y este mes.
 *
 * Un taller cuenta si sus fechas (inicio → fin, o solo inicio) caen en el
 * periodo. Las fechas se comparan como texto 'YYYY-MM-DD' y "hoy" es el de
 * CDMX, así que no hay corrimientos por zona horaria.
 *
 * Es un ESTIMADO: sale de las fechas cargadas en el panel. Un taller sin
 * fecha no cuenta. Lo usan su Perfil y Admin → Profesores.
 */

const ymd = (v) => (v ? String(v).slice(0, 10) : null)

/** 'YYYY-MM-DD' de hoy en CDMX. */
export function hoyCDMX(ahora = new Date()) {
    return ahora.toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
}

function sumarDias(iso, dias) {
    const d = new Date(`${iso}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + dias)
    return d.toISOString().slice(0, 10)
}

/** Lunes a domingo de la semana de `hoy`. */
export function semanaDe(hoy) {
    const dia = new Date(`${hoy}T12:00:00Z`).getUTCDay()      // 0 = domingo
    const desde = sumarDias(hoy, dia === 0 ? -6 : 1 - dia)
    return { desde, hasta: sumarDias(desde, 6) }
}

/** Primer y último día del mes de `hoy`. */
export function mesDe(hoy) {
    const [a, m] = hoy.split('-').map(Number)
    const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
    const mm = String(m).padStart(2, '0')
    return { desde: `${a}-${mm}-01`, hasta: `${a}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

/**
 * @param {Array<{fechaInicio?, fechaFin?, fecha_inicio?, fecha_fin?}>} talleres
 * @returns {{ semana: number, mes: number }}
 */
export function estimadoTalleres(talleres, hoy = hoyCDMX()) {
    const sem = semanaDe(hoy), mes = mesDe(hoy)
    const cuenta = ({ desde, hasta }) => talleres.filter(t => {
        const ini = ymd(t.fechaInicio ?? t.fecha_inicio)
        if (!ini) return false
        const fin = ymd(t.fechaFin ?? t.fecha_fin) || ini
        return ini <= hasta && fin >= desde
    }).length
    return { semana: cuenta(sem), mes: cuenta(mes) }
}
