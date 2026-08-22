/**
 * Destello — Fechas
 *
 * ⚠️ POR QUÉ EXISTE ESTE ARCHIVO
 *
 * `new Date('2026-10-28')` NO da el 28 de octubre en México.
 *
 * JavaScript interpreta las cadenas de solo-fecha como medianoche **UTC**. Al
 * mostrarlas en CDMX (UTC−6) retroceden seis horas y caen en el día anterior:
 *
 *     new Date('2026-10-28').toLocaleDateString('es-MX')  →  "27/10/2026"  ❌
 *
 * Eso hacía que un taller guardado para el 28 se listara como 27 en el panel,
 * y —más grave— que el mensaje de WhatsApp a las alumnas llevara la fecha
 * equivocada.
 *
 * La solución es anclar la fecha al **mediodía local**: así ningún huso horario
 * ni horario de verano la empuja al día de al lado.
 *
 * Usa estas funciones para columnas DATE (`fecha_inicio`, `fecha_fin`,
 * `taller_fecha`). Para timestamps completos (`created_at`, `expires_at`) el
 * `new Date()` de siempre está bien, porque ya traen hora.
 */

/**
 * Convierte una fecha de la BD en un Date anclado al mediodía local.
 * @param {string|Date|null} valor  'YYYY-MM-DD' o ISO completo
 * @returns {Date|null}
 */
export function fechaLocal(valor) {
    if (!valor) return null
    const soloFecha = String(valor).slice(0, 10)
    const d = new Date(`${soloFecha}T12:00:00`)
    return isNaN(d) ? null : d
}

/** "28 oct 2026" */
export function fmtFechaLarga(valor) {
    const d = fechaLocal(valor)
    return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) : null
}

/** "28 oct" */
export function fmtFechaCorta(valor) {
    const d = fechaLocal(valor)
    return d ? d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : null
}

/** "miércoles, 28 de octubre de 2026" — para mensajes a las alumnas. */
export function fmtFechaCompleta(valor) {
    const d = fechaLocal(valor)
    return d
        ? d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        : null
}
