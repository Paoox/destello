/**
 * Destello API — Profesores reales (T-05)
 *
 * Antes de esto, "quién es profe en el aula" lo decidía el FRONTEND con una
 * lista fija de correos admin (`ADMIN_EMAILS`) — la misma lista que decide
 * quién ve el panel `/admin`. Confundía dos cosas distintas: administrar
 * Destello y dar una clase en particular.
 *
 * Aquí "profe de un taller" es un dato real, verificado por el servidor, por
 * TALLER — no una lista fija que vuelve a alguien profe de TODO. Los admins
 * (`isAdminEmail()`, frontend) siguen entrando como profe a cualquier aula
 * sin cambios; esto solo agrega la posibilidad de un profesor real sin ser
 * admin.
 */
import { query } from '../db/db.js'

/** ¿Esta persona da ESTE taller? */
export async function esProfeDelTaller(usuarioId, tallerId) {
    if (!usuarioId || !tallerId) return false
    const { rows } = await query(
        `SELECT 1 FROM taller_profesores WHERE usuario_id = $1 AND taller_id = $2`,
        [usuarioId, tallerId]
    )
    return rows.length > 0
}

/**
 * Todas las asignaciones (profesor ↔ taller), para el panel admin.
 * Una fila por asignación — si un profesor da 2 talleres, salen 2 filas.
 */
export async function listarAsignaciones() {
    const { rows } = await query(
        `SELECT u.id AS usuario_id, u.nombre, u.apellido, u.email,
                t.id AS taller_id, t.nombre AS taller_nombre,
                tp.created_at AS asignado_at
           FROM taller_profesores tp
           JOIN profesores p ON p.usuario_id = tp.usuario_id
           JOIN usuarios u   ON u.id = p.usuario_id
           JOIN talleres t   ON t.id = tp.taller_id
          ORDER BY u.nombre NULLS LAST, t.nombre`
    )
    return rows
}

/**
 * Hace profesora a una cuenta (si no lo era ya) y la asigna a un taller.
 * Idempotente: asignar dos veces lo mismo no truena ni duplica.
 */
export async function asignarProfesor({ usuarioId, tallerId }) {
    await query(
        `INSERT INTO profesores (usuario_id) VALUES ($1)
         ON CONFLICT (usuario_id) DO NOTHING`,
        [usuarioId]
    )
    const { rows } = await query(
        `INSERT INTO taller_profesores (taller_id, usuario_id) VALUES ($1, $2)
         ON CONFLICT (taller_id, usuario_id) DO NOTHING
         RETURNING *`,
        [tallerId, usuarioId]
    )
    return rows[0] ?? null
}

/**
 * Quita a un profesor de UN taller (no borra la cuenta de `profesores`: si
 * da otro taller, lo sigue dando; y da igual si ya no da ninguno, no cuesta
 * nada dejarla ahí para cuando la vuelvan a asignar).
 */
export async function quitarProfesor({ usuarioId, tallerId }) {
    const { rows } = await query(
        `DELETE FROM taller_profesores WHERE usuario_id = $1 AND taller_id = $2 RETURNING *`,
        [usuarioId, tallerId]
    )
    return rows[0] ?? null
}
