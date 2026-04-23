/**
 * Destello API — Lista de Espera Service
 */
import { query } from '../db.js'

export async function listTodas() {
    const { rows } = await query(
        `SELECT le.*, t.nombre AS taller_nombre
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