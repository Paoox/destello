/**
 * Destello API — Lista de Espera Service
 */
import { query } from '../db.js'

/**
 * Registra a alguien en la lista de espera de un taller.
 * Si ya existe el registro, lo devuelve sin duplicar.
 */
export async function registrarEnLista({ email, tallerId, nombre, whatsapp }) {
    // Verificar si ya está en esta lista
    const { rows: existe } = await query(
        `SELECT * FROM lista_espera WHERE email = $1 AND taller_id = $2`,
        [email.toLowerCase().trim(), tallerId]
    )
    if (existe.length > 0) return { nuevo: false, registro: existe[0] }

    const { rows } = await query(
        `INSERT INTO lista_espera (email, taller_id, nombre, whatsapp, estado)
         VALUES ($1, $2, $3, $4, 'pendiente')
         RETURNING *`,
        [email.toLowerCase().trim(), tallerId, nombre || null, whatsapp || null]
    )
    return { nuevo: true, registro: rows[0] }
}

/**
 * Devuelve todas las listas de espera de un email.
 */
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
 * Verifica si hay chispas o resplandores pendientes para un email.
 */
export async function getPendientesPorEmail(email) {
    const emailNorm = email.toLowerCase().trim()

    const { rows: chispas } = await query(
        `SELECT c.code, t.nombre AS taller_nombre
         FROM chispas c
         JOIN talleres t ON t.id = c.taller_id
         WHERE c.usuario_email = $1
           AND c.used = FALSE
           AND c.revoked = FALSE`,
        [emailNorm]
    )

    const { rows: resplandores } = await query(
        `SELECT r.code, r.sent_at
         FROM resplandores r
         JOIN usuarios u ON u.email = r.usuario_email
         WHERE r.usuario_email = $1
           AND r.used = FALSE`,
        [emailNorm]
    )

    return { chispas, resplandores }
}