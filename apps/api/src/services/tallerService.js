/**
 * Destello API — Taller Service
 * Consultas a la tabla `talleres` en PostgreSQL.
 */

import { query } from '../db/db.js'

/**
 * Lista solo los talleres con estado 'activo'.
 * Lo usa el bot y la landing page.
 */
export async function listTalleresActivos() {
    const { rows } = await query(
        `SELECT * FROM talleres
         WHERE estado = 'activo'
         ORDER BY nombre ASC`
    )
    return rows
}

/**
 * Lista todos los talleres sin importar estado.
 * Lo usa el panel admin.
 */
export async function listTodosLosTalleres() {
    const { rows } = await query(
        `SELECT * FROM talleres ORDER BY created_at DESC`
    )
    return rows
}

/**
 * Obtiene un taller por su ID.
 */
export async function getTallerById(id) {
    const { rows } = await query(
        `SELECT * FROM talleres WHERE id = $1`,
        [id]
    )
    return rows[0] ?? null
}

/**
 * Crea un taller nuevo.
 * @param {{ nombre, descripcion, precio, horario, fecha_disponible, estado, categoria }} data
 */
export async function crearTaller(data) {
    const { nombre, descripcion = '', precio = 0, horario = null, fecha_disponible = null, estado = 'activo', categoria = null } = data
    const { rows } = await query(
        `INSERT INTO talleres (nombre, descripcion, precio, horario, fecha_disponible, estado, categoria)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [nombre, descripcion, precio, horario, fecha_disponible, estado, categoria]
    )
    return rows[0]
}

/**
 * Actualiza un taller existente.
 */
export async function actualizarTaller(id, data) {
    const { nombre, descripcion, precio, horario, fecha_disponible, estado, categoria } = data
    const { rows } = await query(
        `UPDATE talleres
         SET nombre = COALESCE($2, nombre),
             descripcion = COALESCE($3, descripcion),
             precio = COALESCE($4, precio),
             horario = COALESCE($5, horario),
             fecha_disponible = COALESCE($6, fecha_disponible),
             estado = COALESCE($7, estado),
             categoria = COALESCE($8, categoria)
         WHERE id = $1
         RETURNING *`,
        [id, nombre, descripcion, precio, horario, fecha_disponible, estado, categoria]
    )
    return rows[0] ?? null
}