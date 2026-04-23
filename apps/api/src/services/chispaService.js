/**
 * Destello API — Chispa Service (PostgreSQL)
 */
import crypto from 'node:crypto'
import { query } from '../db.js'

function generarCodigo(prefix = 'DEST') {
    const seg = () => crypto.randomBytes(2).toString('hex').toUpperCase()
    return `${prefix}-${seg()}-${seg()}`
}

function expiresAt(days) {
    if (!days) return null
    const d = new Date()
    d.setDate(d.getDate() + days)
    return d
}

export async function createChispa({ tallerId, expiresInDays, isDemo = false, createdBy = 'admin', prefix = 'DEST' }) {
    const code = generarCodigo(prefix)
    const exp  = expiresAt(expiresInDays)
    const { rows } = await query(
        `INSERT INTO chispas (code, taller_id, expires_at, is_demo, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [code, tallerId, exp, isDemo, createdBy]
    )
    return rows[0]
}

export async function listChispas({ tallerId, activeOnly } = {}) {
    let sql  = `SELECT c.*, t.nombre AS taller_nombre FROM chispas c
                LEFT JOIN talleres t ON t.id = c.taller_id WHERE 1=1`
    const vals = []
    let i = 1
    if (tallerId)   { sql += ` AND c.taller_id = $${i++}`; vals.push(tallerId) }
    if (activeOnly) { sql += ` AND c.used = FALSE AND c.revoked = FALSE` }
    sql += ` ORDER BY c.created_at DESC`
    const { rows } = await query(sql, vals)
    return rows
}

export async function getStats() {
    const { rows } = await query(`
        SELECT
            COUNT(*)                                                                    AS total,
            COUNT(*) FILTER (WHERE NOT used AND NOT revoked
                AND (expires_at IS NULL OR expires_at > NOW()))                        AS activas,
            COUNT(*) FILTER (WHERE used)                                               AS usadas,
            COUNT(*) FILTER (WHERE expires_at < NOW() AND NOT used AND NOT revoked)   AS expiradas,
            COUNT(*) FILTER (WHERE revoked)                                            AS revocadas,
            COUNT(*) FILTER (WHERE is_demo)                                            AS demo
        FROM chispas
    `)
    const r = rows[0]
    return {
        total:     Number(r.total),
        activas:   Number(r.activas),
        usadas:    Number(r.usadas),
        expiradas: Number(r.expiradas),
        revocadas: Number(r.revocadas),
        demo:      Number(r.demo),
    }
}

export async function validateChispa(code) {
    const { rows } = await query(`SELECT * FROM chispas WHERE code = $1`, [code?.toUpperCase().trim()])
    const c = rows[0]
    if (!c)          return { valid: false, reason: 'INVALID_CODE' }
    if (c.revoked)   return { valid: false, reason: 'REVOKED' }
    if (c.used)      return { valid: false, reason: 'ALREADY_USED' }
    if (c.expires_at && new Date(c.expires_at) < new Date()) return { valid: false, reason: 'EXPIRED' }
    return { valid: true, record: c }
}

export async function consumeChispa(code, usuarioEmail) {
    const { rows } = await query(
        `UPDATE chispas SET used = TRUE, used_at = NOW(), usuario_email = $1
         WHERE code = $2 AND used = FALSE AND revoked = FALSE RETURNING *`,
        [usuarioEmail, code?.toUpperCase().trim()]
    )
    return rows[0] ?? null
}

export async function revokeChispa(code) {
    const { rows } = await query(
        `UPDATE chispas SET revoked = TRUE, revoked_at = NOW()
         WHERE code = $1 RETURNING *`,
        [code?.toUpperCase().trim()]
    )
    return rows[0] ?? null
}

export async function getChispa(code) {
    const { rows } = await query(`SELECT * FROM chispas WHERE code = $1`, [code?.toUpperCase().trim()])
    return rows[0] ?? null
}