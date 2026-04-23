/**
 * Destello API — Taller Service
 */
import { query } from '../db.js'

export async function listTalleresActivos() {
    const { rows } = await query(
        `SELECT * FROM talleres WHERE estado = 'activo' ORDER BY nombre ASC`
    )
    return rows
}

export async function listTodosLosTalleres() {
    const { rows } = await query(
        `SELECT * FROM talleres ORDER BY created_at DESC`
    )
    return rows
}

export async function getTallerById(id) {
    const { rows } = await query(`SELECT * FROM talleres WHERE id = $1`, [id])
    return rows[0] ?? null
}

export async function createTaller({ nombre, descripcion, precio, horario, categoria }) {
    const { rows } = await query(
        `INSERT INTO talleres (nombre, descripcion, precio, horario, categoria, estado)
         VALUES ($1, $2, $3, $4, $5, 'activo') RETURNING *`,
        [nombre, descripcion || null, precio || 0, horario || null, categoria || null]
    )
    return rows[0]
}

export async function updateTaller(id, fields) {
    const allowed = ['nombre', 'descripcion', 'precio', 'horario', 'categoria', 'estado']
    const sets    = []
    const values  = []
    let   idx     = 1

    for (const key of allowed) {
        if (fields[key] !== undefined) {
            sets.push(`${key} = $${idx++}`)
            values.push(fields[key])
        }
    }
    if (!sets.length) return getTallerById(id)

    values.push(id)
    const { rows } = await query(
        `UPDATE talleres SET ${sets.join(', ')}, updated_at = NOW()
         WHERE id = $${idx} RETURNING *`,
        values
    )
    return rows[0] ?? null
}