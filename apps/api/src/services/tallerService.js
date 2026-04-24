/**
 * Destello API — Taller Service
 * Consultas a la tabla `talleres` en PostgreSQL.
 *
 * Columnas reales de la tabla:
 *   id (TEXT slug), nombre, descripcion, precio, horario,
 *   fecha_inicio (DATE), fecha_fin (DATE), cupo_maximo,
 *   imagen_url, estado, categoria, created_at, updated_at
 */

import { query } from '../db/db.js'

/** Genera slug desde el nombre: "Intro a la Auri" → "taller-intro-a-la-auri" */
function toSlug(nombre) {
    return 'taller-' + nombre
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
}

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
 * Obtiene un taller por su ID (slug).
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
 * Si no se pasa `id`, se genera automáticamente desde el nombre.
 */
export async function crearTaller(data) {
    const {
        id,
        nombre,
        descripcion  = null,
        precio       = 0,
        horario      = null,
        fecha_inicio = null,
        fecha_fin    = null,
        cupo_maximo  = null,
        imagen_url   = null,
        estado       = 'activo',
        categoria    = null,
    } = data

    const slug = id?.trim() || toSlug(nombre)

    const { rows } = await query(
        `INSERT INTO talleres
             (id, nombre, descripcion, precio, horario,
              fecha_inicio, fecha_fin, cupo_maximo, imagen_url, estado, categoria)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [slug, nombre, descripcion, precio, horario,
            fecha_inicio || null, fecha_fin || null,
            cupo_maximo  || null, imagen_url || null, estado, categoria || null]
    )
    return rows[0]
}

/**
 * Actualiza un taller existente.
 * Usa COALESCE para no pisar campos que no se envíen.
 */
export async function actualizarTaller(id, data) {
    const {
        nombre,
        descripcion,
        precio,
        horario,
        fecha_inicio,
        fecha_fin,
        cupo_maximo,
        imagen_url,
        estado,
        categoria,
    } = data

    const { rows } = await query(
        `UPDATE talleres
         SET nombre      = COALESCE($2,  nombre),
             descripcion = COALESCE($3,  descripcion),
             precio      = COALESCE($4,  precio),
             horario     = COALESCE($5,  horario),
             fecha_inicio= COALESCE($6,  fecha_inicio),
             fecha_fin   = COALESCE($7,  fecha_fin),
             cupo_maximo = COALESCE($8,  cupo_maximo),
             imagen_url  = COALESCE($9,  imagen_url),
             estado      = COALESCE($10, estado),
             categoria   = COALESCE($11, categoria),
             updated_at  = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, nombre, descripcion, precio ?? null, horario,
            fecha_inicio || null, fecha_fin    || null,
            cupo_maximo  || null, imagen_url   || null,
            estado,               categoria    || null]
    )
    return rows[0] ?? null
}