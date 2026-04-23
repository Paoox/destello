/**
 * Destello API — Taller Service
 * Consultas a la tabla `talleres` en PostgreSQL.
 */

import { query } from '../db.js'

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