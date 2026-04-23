/**
 * Destello API — Resplandor Service
 *
 * Los resplandores son tokens de invitación de UN SOLO USO ligados a un email.
 * Su única función es autorizar la creación de cuenta + perfil de usuario.
 * Una vez usados no pueden reutilizarse ni transferirse.
 *
 * Formato de código: RESP-XXXX-XXXX
 */
import crypto from 'node:crypto'
import { query } from '../db/db.js'

// ── Helpers internos ──────────────────────────────────────────────────────────

function generarCodigo() {
    const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase()
    return `RESP-${seg()}-${seg()}`
}

function expiresAt(days) {
    if (!days) return null
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Crea un resplandor nuevo ligado a un email.
 * @param {{ email: string, nombre?: string, tallerId?: string, expiresInDays?: number, createdBy?: string }} opts
 */
export async function createResplandor({ email, nombre, tallerId, expiresInDays = 7, createdBy = 'admin' }) {
    const code = generarCodigo()
    const exp  = expiresAt(expiresInDays)

    const { rows } = await query(
        `INSERT INTO resplandores (code, email, nombre, taller_id, expires_at, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING *`,
        [code, email.toLowerCase().trim(), nombre || null, tallerId || null, exp, createdBy]
    )
    return rows[0]
}

/**
 * Lista todos los resplandores con información de estado calculada.
 */
export async function listResplandores() {
    const { rows } = await query(
        `SELECT r.*, t.nombre AS taller_nombre
         FROM resplandores r
                  LEFT JOIN talleres t ON t.id = r.taller_id
         ORDER BY r.created_at DESC`
    )
    return rows
}

/**
 * Obtiene estadísticas globales de resplandores.
 */
export async function getStats() {
    const { rows } = await query(`
        SELECT
            COUNT(*)                                                                   AS total,
            COUNT(*) FILTER (WHERE NOT used AND NOT revoked
                AND (expires_at IS NULL OR expires_at > NOW()))                        AS activos,
            COUNT(*) FILTER (WHERE used)                                               AS usados,
            COUNT(*) FILTER (WHERE expires_at < NOW() AND NOT used AND NOT revoked)   AS expirados,
            COUNT(*) FILTER (WHERE revoked)                                            AS revocados
        FROM resplandores
    `)
    const r = rows[0]
    return {
        total:     Number(r.total),
        activos:   Number(r.activos),
        usados:    Number(r.usados),
        expirados: Number(r.expirados),
        revocados: Number(r.revocados),
    }
}

/**
 * Valida un código de resplandor SIN consumirlo.
 * Usado por el frontend en /acceso para verificar antes de mostrar el form de registro.
 * @param {string} code
 * @returns {{ valid: boolean, reason?: string, record?: object }}
 */
export async function validateResplandor(code) {
    const { rows } = await query(
        `SELECT * FROM resplandores WHERE code = $1`,
        [code?.toUpperCase().trim()]
    )
    const r = rows[0]

    if (!r)        return { valid: false, reason: 'INVALID_CODE' }
    if (r.revoked) return { valid: false, reason: 'REVOKED' }
    if (r.used)    return { valid: false, reason: 'ALREADY_USED' }
    if (r.expires_at && new Date(r.expires_at) < new Date())
        return { valid: false, reason: 'EXPIRED' }

    return { valid: true, record: r }
}

/**
 * Consume un resplandor al crear la cuenta del usuario.
 * Solo puede usarse una vez; falla silenciosamente si ya fue usado.
 * @param {string} code
 * @param {string} usuarioEmail  — email del usuario que completó el registro
 * @returns {object|null}
 */
export async function consumeResplandor(code, usuarioEmail) {
    const { rows } = await query(
        `UPDATE resplandores
         SET used = TRUE, used_at = NOW()
         WHERE code = $1
           AND used     = FALSE
           AND revoked  = FALSE
             RETURNING *`,
        [code?.toUpperCase().trim()]
    )
    return rows[0] ?? null
}

/**
 * Revoca un resplandor manualmente (admin).
 * @param {string} code
 */
export async function revokeResplandor(code) {
    const { rows } = await query(
        `UPDATE resplandores
         SET revoked = TRUE, revoked_at = NOW()
         WHERE code = $1
             RETURNING *`,
        [code?.toUpperCase().trim()]
    )
    return rows[0] ?? null
}

/**
 * Busca un resplandor por código (para admin o debug).
 */
export async function getResplandor(code) {
    const { rows } = await query(
        `SELECT * FROM resplandores WHERE code = $1`,
        [code?.toUpperCase().trim()]
    )
    return rows[0] ?? null
}

/**
 * Busca resplandores activos vinculados a un email.
 * Útil para saber si ya se le envió uno antes de crear otro.
 */
export async function getResplandoresPorEmail(email) {
    const { rows } = await query(
        `SELECT * FROM resplandores
         WHERE email = $1
           AND used = FALSE AND revoked = FALSE
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY created_at DESC`,
        [email.toLowerCase().trim()]
    )
    return rows
}