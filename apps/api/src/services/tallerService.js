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
/** Para el bot: solo activo y próximamente (lleno se oculta) */
export async function listTalleresActivos() {
    const { rows } = await query(
        `SELECT * FROM talleres
         WHERE estado IN ('activo', 'proximamente')
         ORDER BY
             CASE estado
                 WHEN 'activo'       THEN 1
                 WHEN 'proximamente' THEN 2
             END,
             nombre ASC`
    )
    return rows
}

/** Para la landing: activo + próximamente + lleno (con sold out badge) */
export async function listTalleresPublicos() {
    // Se trae el cupo junto con el taller para que el Habitat pueda pintar
    // "AGOTADO" sin una segunda llamada. `v_cupo_taller` (migración 008) es la
    // única fórmula del cupo en todo el sistema.
    const { rows } = await query(
        `SELECT t.*,
                cu.cupo_ocupado,
                cu.lugares_libres,
                cu.agotado
         FROM talleres t
         JOIN v_cupo_taller cu ON cu.id = t.id
         WHERE t.estado IN ('activo', 'proximamente', 'lleno')
         ORDER BY
             -- Los agotados hasta abajo: siguen visibles (sirven de prueba
             -- social y para la lista de espera de la próxima edición) pero no
             -- le quitan el lugar a los que sí tienen cupo.
             cu.agotado ASC,
             CASE t.estado
                 WHEN 'activo'       THEN 1
                 WHEN 'proximamente' THEN 2
                 WHEN 'lleno'        THEN 3
             END,
             t.nombre ASC`
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

// ── El horario: un solo dato, no dos ────────────────────────────────────────
//
// EL BUG (25 ago 2026): un taller tiene DOS formas de decir a qué hora es.
//
//   · `horario`     → texto libre, "5:00 PM – 10:00 PM". Es lo que se lee en el
//                     panel, en el Habitat y en el bot.
//   · `hora_inicio` / `hora_fin` → columnas TIME. Es lo que mira la API para
//                     decidir CUÁNDO SE ABRE EL AULA.
//
// El panel de admin guardaba **solo el texto**. Así que Paola puso su taller de
// 5 a 10 PM, el panel lo mostraba bien, y por dentro `hora_inicio` seguía en
// 12:00 — el aula habría abierto a las 11:30 de la mañana y a las 5 de la tarde
// el botón ya no estaría. Ella lo vio: el badge decía "Hoy · 12:00 PM".
//
// Dos campos para el mismo hecho siempre se separan; es cuestión de tiempo. La
// solución no es acordarse de llenar los dos, es que **el texto mande** y las
// columnas se deriven de él aquí, en el único lugar por donde pasan todos los
// que guardan un taller.

/** '5:00 PM' → '17:00:00'. `null` si no se entiende. */
export function horaDesdeTexto(txt) {
    if (!txt) return null
    const m = String(txt).trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i)
    if (!m) return null

    let h = Number(m[1])
    const min = m[2] ?? '00'
    const sufijo = m[3]?.toLowerCase().replace(/\./g, '')

    if (h < 0 || h > 23) return null
    if (sufijo === 'pm' && h < 12) h += 12
    if (sufijo === 'am' && h === 12) h = 0
    // Sin sufijo se toma tal cual: ya viene en 24 h.
    return `${String(h).padStart(2, '0')}:${min}:00`
}

/**
 * Parte "5:00 PM – 10:00 PM" en sus dos horas.
 *
 * Acepta el guion largo (–) que pone el panel y también el corto (-) o " a ",
 * porque el texto se ha escrito a mano más de una vez.
 */
export function horasDesdeHorario(horario) {
    if (!horario) return { inicio: null, fin: null }
    const partes = String(horario).split(/\s*(?:–|—|-|\ba\b)\s*/i)
    return {
        inicio: horaDesdeTexto(partes[0]),
        fin:    horaDesdeTexto(partes[1]),
    }
}

/**
 * Decide qué hora guardar.
 *
 * Gana lo que venga explícito en `hora_inicio`/`hora_fin` (por si algún día se
 * captura aparte o llega de una importación); si no vino, se deriva del texto.
 * Nunca se inventa: si el texto no se entiende, se deja `null` y el cálculo del
 * aula cae a la regla por día, que es el comportamiento seguro.
 */
function resolverHoras({ horario, hora_inicio, hora_fin }) {
    const der = horasDesdeHorario(horario)
    return {
        hora_inicio: hora_inicio || der.inicio || null,
        hora_fin:    hora_fin    || der.fin    || null,
    }
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
    // Las horas se derivan del texto: ver el comentario de `resolverHoras`.
    const { hora_inicio, hora_fin } = resolverHoras(data)

    const { rows } = await query(
        `INSERT INTO talleres
             (id, nombre, descripcion, precio, horario, hora_inicio, hora_fin,
              fecha_inicio, fecha_fin, cupo_maximo, imagen_url, estado, categoria)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING *`,
        [slug, nombre, descripcion, precio, horario, hora_inicio || null, hora_fin || null,
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

    // ⚠️ Cuando llega un `horario` nuevo, las horas SIEMPRE se recalculan de él.
    // Si se dejaran al COALESCE de abajo, editar el horario en el panel cambiaría
    // el texto y las columnas TIME se quedarían con la hora vieja — que es
    // exactamente el bug que esto viene a cerrar.
    const { hora_inicio, hora_fin } = resolverHoras(data)

    const { rows } = await query(
        `UPDATE talleres
         SET nombre      = COALESCE($2,  nombre),
             descripcion = COALESCE($3,  descripcion),
             precio      = COALESCE($4,  precio),
             horario     = COALESCE($5,  horario),
             hora_inicio = COALESCE($6,  hora_inicio),
             hora_fin    = COALESCE($7,  hora_fin),
             fecha_inicio= COALESCE($8,  fecha_inicio),
             fecha_fin   = COALESCE($9,  fecha_fin),
             cupo_maximo = COALESCE($10, cupo_maximo),
             imagen_url  = COALESCE($11, imagen_url),
             estado      = COALESCE($12, estado),
             categoria   = COALESCE($13, categoria),
             updated_at  = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, nombre, descripcion, precio ?? null, horario, hora_inicio || null, hora_fin || null,
            fecha_inicio || null, fecha_fin    || null,
            cupo_maximo  || null, imagen_url   || null,
            estado,               categoria    || null]
    )
    return rows[0] ?? null
}