/**
 * Destello API — Chispa Service (PostgreSQL)
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica de negocio para chispas (códigos de acceso a talleres).
 * Persiste en la tabla `chispas` de PostgreSQL.
 *
 * Columnas requeridas en la tabla (ejecutar en pgAdmin si faltan):
 *
 *   ALTER TABLE chispas
 *     ADD COLUMN IF NOT EXISTS usuario_nombre TEXT,
 *     ADD COLUMN IF NOT EXISTS taller_nombre  TEXT,
 *     ADD COLUMN IF NOT EXISTS usuario_wa     TEXT;
 */

import crypto    from 'node:crypto'
import { query } from '../db/db.js'

// ── Mapper snake_case → camelCase ─────────────────────────────────────────────
// Convierte una fila de PostgreSQL al formato que espera el frontend.
function toChispa(row) {
    if (!row) return null
    return {
        code:          row.code,
        tallerId:      row.taller_id,
        tallerNombre:  row.taller_nombre  ?? null,
        usuarioEmail:  row.usuario_email  ?? null,
        usuarioNombre: row.usuario_nombre ?? null,
        usuarioWa:     row.usuario_wa     ?? null,
        pagoId:        row.pago_id        ?? null,
        createdBy:     row.created_by,
        createdAt:     row.created_at,
        expiresAt:     row.expires_at     ?? null,
        used:          row.used,
        usedBy:        row.used_by        ?? null,
        revoked:       row.revoked,
        isDemo:        row.is_demo,
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomSegment() {
    return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)
}

function buildCode(prefix = 'DEST') {
    return `${prefix}-${randomSegment()}-${randomSegment()}`
}

async function uniqueCode(prefix) {
    let attempts = 0
    while (true) {
        const code = buildCode(prefix)
        const { rows } = await query('SELECT 1 FROM chispas WHERE code = $1', [code])
        if (rows.length === 0) return code
        if (++attempts > 10) throw new Error('No se pudo generar código único')
    }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Crea y persiste una nueva chispa.
 */
export async function createChispa({
                                       tallerId,
                                       tallerNombre  = null,
                                       createdBy     = 'admin',
                                       expiresInDays = 30,
                                       prefix        = 'DEST',
                                       isDemo        = false,
                                       usuarioNombre = null,
                                       usuarioEmail  = null,
                                       usuarioWa     = null,
                                   }) {
    if (!tallerId) throw new Error('tallerId es requerido')

    const code      = await uniqueCode(prefix.toUpperCase())
    const expiresAt = expiresInDays != null
        ? new Date(Date.now() + expiresInDays * 86_400_000)
        : null

    const { rows } = await query(
        `INSERT INTO chispas
         (code, taller_id, taller_nombre,
          usuario_email, usuario_nombre, usuario_wa,
          created_by, expires_at, is_demo,
          used, revoked, created_at)
         VALUES
             ($1, $2, $3,
              $4, $5, $6,
              $7, $8, $9,
              FALSE, FALSE, NOW())
             RETURNING *`,
        [
            code,
            tallerId,
            tallerNombre  || null,
            usuarioEmail  || null,
            usuarioNombre || null,
            usuarioWa     || null,
            createdBy,
            expiresAt,
            Boolean(isDemo),
        ]
    )

    return toChispa(rows[0])
}

/**
 * Lista todas las chispas con filtros opcionales.
 * Ordenadas por fecha de creación descendente.
 */
export async function listChispas({ tallerId, activeOnly } = {}) {
    const conditions = []
    const params     = []

    if (tallerId) {
        params.push(tallerId)
        conditions.push(`taller_id = $${params.length}`)
    }

    if (activeOnly) {
        conditions.push(`used = FALSE AND revoked = FALSE AND (expires_at IS NULL OR expires_at > NOW())`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await query(
        `SELECT * FROM chispas ${where} ORDER BY created_at DESC`,
        params
    )

    return rows.map(toChispa)
}

/**
 * Obtiene una chispa por código.
 */
export async function getChispa(code) {
    const { rows } = await query(
        'SELECT * FROM chispas WHERE code = $1',
        [code?.toUpperCase().trim()]
    )
    return toChispa(rows[0] ?? null)
}

/**
 * Estadísticas globales.
 */
export async function getStats() {
    const { rows } = await query(`
        SELECT
            COUNT(*)                                                                    AS total,
            COUNT(*) FILTER (
                WHERE used = FALSE AND revoked = FALSE
                  AND (expires_at IS NULL OR expires_at > NOW())
            )                                                                           AS active,
            COUNT(*) FILTER (WHERE used = TRUE)                                        AS used,
            COUNT(*) FILTER (WHERE revoked = TRUE)                                     AS revoked,
            COUNT(*) FILTER (
                WHERE used = FALSE AND revoked = FALSE
                  AND expires_at IS NOT NULL AND expires_at <= NOW()
            )                                                                           AS expired,
            COUNT(*) FILTER (WHERE is_demo = TRUE)                                     AS demo
        FROM chispas
    `)

    const r = rows[0]
    return {
        total:   Number(r.total),
        active:  Number(r.active),
        used:    Number(r.used),
        revoked: Number(r.revoked),
        expired: Number(r.expired),
        demo:    Number(r.demo),
    }
}

/**
 * Valida una chispa. Si se pasa userId, la marca como usada.
 */
export async function validateChispa(code, userId = null) {
    const normalized = code?.toUpperCase().trim()
    const chispa     = await getChispa(normalized)

    if (!chispa)          return { valid: false, reason: 'INVALID_CODE' }
    if (chispa.revoked)   return { valid: false, reason: 'REVOKED' }
    if (chispa.used)      return { valid: false, reason: 'ALREADY_USED' }
    if (chispa.expiresAt && new Date(chispa.expiresAt) < new Date()) {
        return { valid: false, reason: 'EXPIRED' }
    }

    if (userId) {
        await query(
            `UPDATE chispas SET used = TRUE, used_at = NOW(), used_by = $2 WHERE code = $1`,
            [normalized, userId]
        )
    }

    return { valid: true, record: chispa }
}

/**
 * Revoca una chispa permanentemente.
 */
export async function revokeChispa(code) {
    const { rows } = await query(
        `UPDATE chispas SET revoked = TRUE WHERE code = $1 RETURNING code`,
        [code?.toUpperCase().trim()]
    )
    return rows.length > 0
}