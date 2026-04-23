/**
 * Destello API — Usuario Service
 * Guardar y consultar usuarios en PostgreSQL.
 */

import { query } from '../db/db.js'

/**
 * Crea un usuario nuevo O actualiza sus datos si el correo ya existe.
 * Siempre deja el estado en 'espera' si es la primera vez.
 *
 * @param {Object} opts
 * @param {string} opts.email
 * @param {string} [opts.nombre]
 * @param {string} [opts.whatsapp]
 * @returns {Object} usuario creado o actualizado
 */
export async function upsertUsuario({ email, nombre, whatsapp }) {
    const emailNorm = email.toLowerCase().trim()

    const { rows } = await query(
        `INSERT INTO usuarios (email, nombre, whatsapp, estado)
         VALUES ($1, $2, $3, 'espera')
         ON CONFLICT (email) DO UPDATE SET
             nombre     = COALESCE(EXCLUDED.nombre,    usuarios.nombre),
             whatsapp   = COALESCE(EXCLUDED.whatsapp,  usuarios.whatsapp),
             updated_at = NOW()
         RETURNING id, email, nombre, whatsapp, estado, created_at`,
        [emailNorm, nombre || null, whatsapp || null]
    )
    return rows[0]
}

/**
 * Busca un usuario por email.
 */
export async function findByEmail(email) {
    const { rows } = await query(
        `SELECT * FROM usuarios WHERE email = $1`,
        [email.toLowerCase().trim()]
    )
    return rows[0] ?? null
}