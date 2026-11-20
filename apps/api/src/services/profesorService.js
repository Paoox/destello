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
import { query, withTransaction } from '../db/db.js'
import { AppError } from '../middleware/errorHandler.js'
import { normalizarWhatsapp, asegurarWhatsappLibre } from './usuarioService.js'

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
                -- Fechas como texto (sin corrimiento de zona) para el estimado
                -- de talleres por semana/mes en el panel.
                to_char(t.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
                to_char(t.fecha_fin,    'YYYY-MM-DD') AS fecha_fin,
                t.horario,
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
 * Un taller lo da UNA profesora (decisión de Paola, 18 nov 2026). Si ya
 * tiene a alguien más, no se asigna: primero hay que quitarla en el panel.
 * Asignar a la MISMA persona otra vez no es error (idempotente).
 * Respaldo en la base: índice único `uq_taller_profesores_un_profe` (019).
 */
export async function asegurarTallerLibre(tallerId, usuarioId, q = query) {
    const { rows } = await q(
        `SELECT u.nombre, u.apellido, u.email
           FROM taller_profesores tp JOIN usuarios u ON u.id = tp.usuario_id
          WHERE tp.taller_id = $1 AND tp.usuario_id <> $2
          LIMIT 1`,
        [tallerId, usuarioId ?? 0]
    )
    if (rows.length) {
        const quien = [rows[0].nombre, rows[0].apellido].filter(Boolean).join(' ') || rows[0].email
        throw new AppError(
            `Ese taller ya lo da ${quien}. Quítala de ese taller antes de asignar a alguien más.`,
            409, 'TALLER_CON_PROFE'
        )
    }
}

/**
 * Hace profesora a una cuenta (si no lo era ya) y la asigna a un taller.
 * Idempotente: asignar dos veces lo mismo no truena ni duplica.
 */
export async function asignarProfesor({ usuarioId, tallerId }) {
    await asegurarTallerLibre(tallerId, usuarioId)
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

/**
 * Revisa y limpia los datos del alta (T-40) antes de tocar la base.
 * WhatsApp es opcional (con Google basta para entrar), pero si viene tiene
 * que ser un número usable: un número mal escrito guardado en silencio
 * después no le serviría para entrar por código.
 */
export function validarAlta({ email, nombre, apellido, whatsapp, tallerId } = {}) {
    const correo = String(email ?? '').toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
        throw new AppError('Escribe un correo válido', 400, 'BAD_REQUEST')
    }
    const limpio = (v) => String(v ?? '').replace(/\s+/g, ' ').trim() || null
    const nom = limpio(nombre)
    if (!nom) throw new AppError('El nombre es obligatorio', 400, 'BAD_REQUEST')
    if (!tallerId) throw new AppError('Elige el taller que va a dar', 400, 'BAD_REQUEST')

    let wa = null
    if (limpio(whatsapp)) {
        wa = normalizarWhatsapp(whatsapp)
        if (!wa) throw new AppError('El WhatsApp debe tener 10 dígitos', 400, 'BAD_REQUEST')
    }
    return { email: correo, nombre: nom, apellido: limpio(apellido), whatsapp: wa, tallerId: String(tallerId) }
}

/**
 * Da de alta a un profesor en un solo paso (T-40): crea su cuenta ya activa
 * (o activa la que tenga) y la asigna al taller. Sin bot, sin lista de espera,
 * sin chispa — dar la clase ya es su acceso (ver T-05).
 *
 * Mismo criterio que "Crear Chispa" (`chispaService.createChispa`): si la
 * cuenta ya existía NO se pisan sus datos (nombre/WhatsApp que ella misma
 * capturó), solo se rellenan los vacíos. El WhatsApp no puede ser de otra
 * cuenta (WA_EN_USO, 409). Cuenta y asignación van juntas: o queda todo o nada.
 *
 * @returns {{ usuario, creada: boolean, asignacion }}
 */
export async function altaProfesor(datos) {
    const { email, nombre, apellido, whatsapp, tallerId } = validarAlta(datos)

    const { rows: taller } = await query('SELECT id FROM talleres WHERE id = $1', [tallerId])
    if (!taller.length) throw new AppError('Ese taller no existe', 404, 'NOT_FOUND')

    const { rows: propia } = await query('SELECT id FROM usuarios WHERE email = $1', [email])
    await asegurarTallerLibre(tallerId, propia[0]?.id ?? null)
    const wa = whatsapp ? await asegurarWhatsappLibre(whatsapp, propia[0]?.id ?? null) : null

    return withTransaction(async (q) => {
        const { rows } = await q(
            `INSERT INTO usuarios (email, nombre, apellido, whatsapp, estado, activado_por, origen)
             VALUES ($1, $2, $3, $4, 'activo', 'admin:profesor', 'admin')
             ON CONFLICT (email) DO UPDATE
               SET nombre       = COALESCE(usuarios.nombre,   EXCLUDED.nombre),
                   apellido     = COALESCE(usuarios.apellido, EXCLUDED.apellido),
                   whatsapp     = COALESCE(usuarios.whatsapp, EXCLUDED.whatsapp),
                   estado       = 'activo',
                   activado_por = COALESCE(usuarios.activado_por, 'admin:profesor'),
                   updated_at   = NOW()
             RETURNING id, email, nombre, apellido, whatsapp, acceso_bloqueado,
                       (xmax = 0) AS creada`,
            [email, nombre, apellido, wa]
        )
        const { creada, ...usuario } = rows[0]

        await q(
            `INSERT INTO profesores (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING`,
            [usuario.id]
        )
        const { rows: asig } = await q(
            `INSERT INTO taller_profesores (taller_id, usuario_id) VALUES ($1, $2)
             ON CONFLICT (taller_id, usuario_id) DO NOTHING
             RETURNING *`,
            [tallerId, usuario.id]
        )
        return { usuario, creada, asignacion: asig[0] ?? null }
    })
}

// ══════════════════════════════════════════════════════════════════════════
//  Ficha pública — "Conoce a tus profes" (Novedades, 19 nov 2026, migración 026)
// ══════════════════════════════════════════════════════════════════════════

export const LIMITES_FICHA = { especialidad: 120, semblanza: 600, lineaFormacion: 150, lineasFormacion: 8, fotoBytes: 450_000 }

/**
 * Limpia y valida lo que manda el panel (pura, con pruebas).
 * `foto`: undefined = no tocarla · null = quitarla · data URL = reemplazarla.
 * @returns {{ ok: true, ficha: object } | { ok: false, message: string }}
 */
export function validarFicha(d = {}) {
    const L = LIMITES_FICHA
    const texto = (v) => (v == null ? null : String(v).trim() || null)
    const especialidad = texto(d.especialidad)
    const semblanza    = texto(d.semblanza)
    if (especialidad && especialidad.length > L.especialidad) return { ok: false, message: `La especialidad es muy larga (máx. ${L.especialidad} letras)` }
    if (semblanza && semblanza.length > L.semblanza) return { ok: false, message: `La semblanza es muy larga (máx. ${L.semblanza} letras)` }

    const lineas = String(d.formacion ?? '').split('\n').map(l => l.trim()).filter(Boolean)
    if (lineas.length > L.lineasFormacion) return { ok: false, message: `Máximo ${L.lineasFormacion} líneas de formación` }
    if (lineas.some(l => l.length > L.lineaFormacion)) return { ok: false, message: `Cada línea de formación: máx. ${L.lineaFormacion} letras` }

    let anios = null
    if (d.aniosExperiencia !== undefined && d.aniosExperiencia !== null && d.aniosExperiencia !== '') {
        anios = Number(d.aniosExperiencia)
        if (!Number.isInteger(anios) || anios < 0 || anios > 80) return { ok: false, message: 'Los años de experiencia deben ser un número entre 0 y 80' }
    }

    let foto
    if (d.foto === null) foto = null
    else if (d.foto !== undefined) {
        if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(String(d.foto))) return { ok: false, message: 'La foto debe ser JPG, PNG o WEBP' }
        if (String(d.foto).length > L.fotoBytes) return { ok: false, message: 'La foto pesa demasiado' }
        foto = d.foto
    }

    return { ok: true, ficha: {
        especialidad, semblanza, formacion: lineas.join('\n') || null,
        aniosExperiencia: anios, publicada: d.publicada !== false, foto,
    } }
}

/** Para el panel: la ficha de cada profe, por usuario_id. */
export async function fichasParaPanel() {
    const { rows } = await query(
        `SELECT p.usuario_id, p.foto, u.foto AS foto_perfil, p.especialidad, p.semblanza,
                p.anios_experiencia, p.formacion, p.ficha_publicada, p.ficha_updated_at
           FROM profesores p JOIN usuarios u ON u.id = p.usuario_id`)
    return Object.fromEntries(rows.map(r => [r.usuario_id, r]))
}

export async function guardarFicha(usuarioId, datos) {
    const v = validarFicha(datos)
    if (!v.ok) throw new AppError(v.message, 400, 'BAD_REQUEST')
    const f = v.ficha
    const { rows } = await query(
        `UPDATE profesores
            SET especialidad = $2, semblanza = $3, formacion = $4, anios_experiencia = $5,
                ficha_publicada = $6,
                foto = CASE WHEN $7::boolean THEN $8 ELSE foto END,
                ficha_updated_at = NOW()
          WHERE usuario_id = $1
      RETURNING usuario_id`,
        [usuarioId, f.especialidad, f.semblanza, f.formacion, f.aniosExperiencia, f.publicada,
         f.foto !== undefined, f.foto ?? null])
    if (!rows.length) throw new AppError('Esa cuenta no es profesora', 404, 'NOT_FOUND')
    return { ok: true }
}

/**
 * Público: profes con al menos un taller asignado y ficha publicada.
 * Nunca correo ni WhatsApp. Nombre = nombre + primer apellido.
 */
export async function fichasPublicas() {
    const { rows } = await query(
        `SELECT p.usuario_id AS id, u.nombre, u.apellido,
                COALESCE(p.foto, u.foto) AS foto,
                p.especialidad, p.semblanza, p.anios_experiencia, p.formacion,
                json_agg(json_build_object(
                    'id', t.id, 'nombre', t.nombre, 'categoria', t.categoria, 'estado', t.estado,
                    'fecha_inicio', to_char(t.fecha_inicio, 'YYYY-MM-DD'))
                  ORDER BY t.fecha_inicio NULLS LAST) AS talleres
           FROM profesores p
           JOIN usuarios u ON u.id = p.usuario_id
           JOIN taller_profesores tp ON tp.usuario_id = p.usuario_id
           JOIN talleres t ON t.id = tp.taller_id AND t.estado IN ('activo', 'proximamente', 'lleno')
          WHERE p.ficha_publicada
          GROUP BY p.usuario_id, u.nombre, u.apellido, u.foto
          ORDER BY u.nombre`)
    return rows.map(r => ({
        id: r.id,
        nombre: [r.nombre, String(r.apellido ?? '').trim().split(/\s+/)[0]].filter(Boolean).join(' '),
        foto: r.foto, especialidad: r.especialidad, semblanza: r.semblanza,
        aniosExperiencia: r.anios_experiencia,
        formacion: r.formacion ? r.formacion.split('\n') : [],
        talleres: r.talleres,
    }))
}
