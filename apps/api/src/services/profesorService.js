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
 * Hace profesora a una cuenta (si no lo era ya) y la asigna a un taller.
 * Idempotente: asignar dos veces lo mismo no truena ni duplica.
 */
export async function asignarProfesor({ usuarioId, tallerId }) {
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
