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

// ── Racha de constancia ─────────────────────────────────────────────────────────

/** Fecha de hoy en CDMX (UTC−6), como 'YYYY-MM-DD'. */
function hoyCDMX() {
    return new Date(Date.now() - 6 * 3600 * 1000).toISOString().slice(0, 10)
}

/**
 * Registra actividad del usuario (una visita a la plataforma) y actualiza la racha.
 * · Si ya se contó hoy → no cambia.
 * · Si la última actividad fue ayer → racha + 1.
 * · Si fue antes (o nunca) → racha se reinicia a 1.
 * @returns {number} la racha actualizada
 */
export async function registrarActividad(userId) {
    const { rows } = await query(
        'SELECT racha, ultima_actividad FROM usuarios WHERE id = $1',
        [userId]
    )
    const u = rows[0]
    if (!u) return 0

    const hoy = hoyCDMX()
    const ult = u.ultima_actividad ? String(u.ultima_actividad).slice(0, 10) : null
    let racha = Number(u.racha || 0)

    if (ult === hoy) return racha // ya contamos hoy

    const ayer = new Date(new Date(hoy).getTime() - 86_400_000).toISOString().slice(0, 10)
    racha = ult === ayer ? racha + 1 : 1

    await query(
        'UPDATE usuarios SET racha = $2, ultima_actividad = $3 WHERE id = $1',
        [userId, racha, hoy]
    )
    return racha
}

/** Cuenta las insignias (logros) del usuario. */
export async function contarInsignias(email) {
    const { rows } = await query(
        'SELECT COUNT(*)::int AS total FROM insignias WHERE LOWER(usuario_email) = LOWER($1)',
        [email]
    )
    return rows[0]?.total ?? 0
}