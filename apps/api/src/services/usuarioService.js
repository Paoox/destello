/**
 * Destello API — Usuario Service
 * Guardar y consultar usuarios en PostgreSQL.
 */

import { query } from '../db/db.js'
import { AppError } from '../middleware/errorHandler.js'

// ── WhatsApp: normalización y unicidad ──────────────────────────────────────────
//
// REGLA DE NEGOCIO: un número de WhatsApp pertenece a UNA sola cuenta.
// El login por número (`/auth/phone/verify`) busca al usuario por su whatsapp;
// si dos cuentas comparten número, la persona entra a la cuenta equivocada.
// Eso es acceso cruzado a datos de alguien más, no un detalle de UX.
//
// La garantía real vive en la BD (índice único parcial sobre usuarios.whatsapp,
// ver `apps/api/src/db/migrations/001_whatsapp_unico.sql`). Estas funciones son
// la primera línea: atrapan el choque ANTES de escribir para poder dar un
// mensaje entendible en vez de un error 500 de Postgres.

/**
 * Deja un número en el formato canónico de la BD: 10 dígitos, sin lada ni signos.
 * @returns {string|null} los 10 dígitos, o null si no es un número usable
 */
export function normalizarWhatsapp(wa) {
    if (wa == null) return null
    const digitos = String(wa).replace(/\D/g, '').slice(-10)
    return digitos.length === 10 ? digitos : null
}

/**
 * Devuelve la cuenta que ya tiene ese número, o null si está libre.
 * @param {string} wa
 * @param {number|string} [excluirUsuarioId] - ignora esta cuenta (la propia)
 */
export async function cuentaConWhatsapp(wa, excluirUsuarioId = null) {
    const num = normalizarWhatsapp(wa)
    if (!num) return null

    const { rows } = await query(
        `SELECT id, email, nombre, estado
         FROM usuarios
         WHERE whatsapp = $1
           AND ($2::bigint IS NULL OR id <> $2::bigint)
         ORDER BY id
         LIMIT 1`,
        [num, excluirUsuarioId ?? null]
    )
    return rows[0] ?? null
}

/**
 * Enmascara un correo para poder mostrarlo sin exponerlo.
 *   pao.arreola.g@gmail.com → p•••••••••••g@gmail.com
 *
 * POR QUÉ enmascarar: al decir "ese número ya está en uso" hay que dar una pista
 * suficiente para que la persona reconozca SU propia cuenta, pero sin regalarle
 * el correo completo de alguien más a quien nada más está probando números.
 */
export function enmascararEmail(email) {
    if (!email || !email.includes('@')) return 'otra cuenta'
    const [local, dominio] = email.split('@')
    if (local.length <= 2) return `${local[0]}•@${dominio}`
    return `${local[0]}${'•'.repeat(Math.min(local.length - 2, 12))}${local.at(-1)}@${dominio}`
}

/**
 * Valida que el número esté libre. Lanza AppError 409 si ya es de otra cuenta.
 * El mensaje nombra la cuenta dueña (enmascarada) para que la persona sepa qué
 * hacer: casi siempre es ella misma con su otro correo.
 * @returns {string|null} el número normalizado, listo para guardar
 */
export async function asegurarWhatsappLibre(wa, excluirUsuarioId = null) {
    const num = normalizarWhatsapp(wa)
    if (!num) return null

    const dueño = await cuentaConWhatsapp(num, excluirUsuarioId)
    if (dueño) {
        throw new AppError(
            `Ese número ya está ligado a la cuenta ${enmascararEmail(dueño.email)}. ` +
            `Si es tuya, entra con ese correo; si no, escríbenos por WhatsApp y lo resolvemos.`,
            409,
            'WA_EN_USO',
        )
    }
    return num
}

/**
 * Crea un usuario nuevo O actualiza sus datos si el correo ya existe.
 * Siempre deja el estado en 'espera' si es la primera vez.
 *
 * El WhatsApp solo se guarda si está libre; si ya es de otra cuenta se lanza
 * WA_EN_USO (409) y NO se crea/actualiza nada.
 *
 * @param {Object} opts
 * @param {string} opts.email
 * @param {string} [opts.nombre]
 * @param {string} [opts.whatsapp]
 * @returns {Object} usuario creado o actualizado
 */
export async function upsertUsuario({ email, nombre, apellido, whatsapp }) {
    const emailNorm = email.toLowerCase().trim()

    // El dueño legítimo del número puede ser esta misma cuenta (mismo correo):
    // en ese caso no hay choque, por eso se excluye por id.
    const propia = await findByEmail(emailNorm)
    const waNorm = await asegurarWhatsappLibre(whatsapp, propia?.id ?? null)

    const { rows } = await query(
        `INSERT INTO usuarios (email, nombre, apellido, whatsapp, estado)
         VALUES ($1, $2, $3, $4, 'espera')
         ON CONFLICT (email) DO UPDATE SET
             nombre     = COALESCE(EXCLUDED.nombre,    usuarios.nombre),
             apellido   = COALESCE(EXCLUDED.apellido,  usuarios.apellido),
             whatsapp   = COALESCE(EXCLUDED.whatsapp,  usuarios.whatsapp),
             updated_at = NOW()
         RETURNING id, email, nombre, apellido, whatsapp, estado, created_at`,
        [emailNorm, nombre || null, apellido || null, waNorm]
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