/**
 * Destello API — Lista de Espera Service
 */
import { query } from '../db/db.js'

export async function listTodas() {
    const { rows } = await query(
        `SELECT le.*,
                t.nombre AS taller_nombre,
                EXISTS (
                    SELECT 1 FROM resplandores r
                    WHERE LOWER(r.email) = LOWER(le.email)
                ) AS tiene_resplandor
         FROM lista_espera le
                  JOIN talleres t ON t.id = le.taller_id
         ORDER BY le.created_at DESC`
    )
    return rows
}

export async function listPorTaller(tallerId) {
    const { rows } = await query(
        `SELECT le.*, t.nombre AS taller_nombre
         FROM lista_espera le
                  JOIN talleres t ON t.id = le.taller_id
         WHERE le.taller_id = $1
         ORDER BY le.created_at ASC`,
        [tallerId]
    )
    return rows
}

export async function registrarEnLista({ email, tallerId, nombre, whatsapp }) {
    const { rows: existe } = await query(
        `SELECT * FROM lista_espera WHERE email = $1 AND taller_id = $2`,
        [email.toLowerCase().trim(), tallerId]
    )
    if (existe.length > 0) return { nuevo: false, registro: existe[0] }

    const { rows } = await query(
        `INSERT INTO lista_espera (email, taller_id, nombre, whatsapp, estado)
         VALUES ($1, $2, $3, $4, 'pendiente') RETURNING *`,
        [email.toLowerCase().trim(), tallerId, nombre || null, whatsapp || null]
    )
    return { nuevo: true, registro: rows[0] }
}

export async function actualizarEstado(id, estado) {
    const { rows } = await query(
        `UPDATE lista_espera SET estado = $1 WHERE id = $2 RETURNING *`,
        [estado, id]
    )
    return rows[0] ?? null
}

export async function getListasPorEmail(email) {
    const { rows } = await query(
        `SELECT le.*, t.nombre AS taller_nombre
         FROM lista_espera le
                  JOIN talleres t ON t.id = le.taller_id
         WHERE le.email = $1
         ORDER BY le.created_at DESC`,
        [email.toLowerCase().trim()]
    )
    return rows
}

/**
 * Devuelve chispas activas y resplandores activos pendientes para un email.
 * Usado por el bot cuando el alumno dice "no me llegó mi código".
 */
export async function getPendientesPorEmail(email) {
    const emailNorm = email.toLowerCase().trim()

    const { rows: chispas } = await query(
        `SELECT c.code, t.nombre AS taller_nombre
         FROM chispas c
                  JOIN talleres t ON t.id = c.taller_id
         WHERE LOWER(c.email) = $1
           AND c.estado = 'activa'`,
        [emailNorm]
    )

    const { rows: resplandores } = await query(
        `SELECT code, email
         FROM resplandores
         WHERE LOWER(email) = $1
           AND estado = 'activo'`,
        [emailNorm]
    )

    return { chispas, resplandores }
}