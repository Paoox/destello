/**
 * Destello API — Chispa Service (PostgreSQL)
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica de negocio para chispas (códigos de acceso a talleres).
 * Persiste en la tabla `chispas` de PostgreSQL.
 *
 * Tabla esperada:
 *   code           TEXT PRIMARY KEY
 *   taller_id      TEXT NOT NULL
 *   taller_nombre  TEXT
 *   usuario_email  TEXT
 *   usuario_nombre TEXT
 *   usuario_wa     TEXT
 *   pago_id        TEXT
 *   created_by     TEXT NOT NULL
 *   created_at     TIMESTAMPTZ DEFAULT NOW()
 *   expires_at     TIMESTAMPTZ
 *   used           BOOLEAN DEFAULT FALSE
 *   used_at        TIMESTAMPTZ
 *   revoked        BOOLEAN DEFAULT FALSE
 *   is_demo        BOOLEAN DEFAULT FALSE
 *
 * Si alguna columna no existe aún, corre en pgAdmin:
 *   ALTER TABLE chispas
 *     ADD COLUMN IF NOT EXISTS usuario_nombre TEXT,
 *     ADD COLUMN IF NOT EXISTS taller_nombre  TEXT,
 *     ADD COLUMN IF NOT EXISTS usuario_wa     TEXT;
 */

import crypto      from 'node:crypto'
import { query }   from '../db/db.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomSegment() {
    return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)
}

function buildCode(prefix = 'DEST') {
    return `${prefix}-${randomSegment()}-${randomSegment()}`
}

async function uniqueCode(prefix) {
    let code
    let attempts = 0
    do {
        code = buildCode(prefix)
        const { rows } = await query('SELECT 1 FROM chispas WHERE code = $1', [code])
        if (rows.length === 0) return code
        attempts++
        if (attempts > 10) throw new Error('No se pudo generar código único')
    } while (true)
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Crea y persiste una nueva chispa.
 *
 * @param {Object}      opts
 * @param {string}      opts.tallerId
 * @param {string|null} opts.tallerNombre
 * @param {string}      opts.createdBy
 * @param {number|null} opts.expiresInDays   null = sin límite
 * @param {string}      [opts.prefix]        default: 'DEST'
 * @param {boolean}     [opts.isDemo]
 * @param {string|null} [opts.usuarioNombre]
 * @param {string|null} [opts.usuarioEmail]
 * @param {string|null} [opts.usuarioWa]     10 dígitos MX
 * @returns {Promise<Object>} registro guardado
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
            ($1,  $2,  $3,
             $4,  $5,  $6,
             $7,  $8,  $9,
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

    return rows[0]
}

/**
 * Lista todas las chispas con filtros opcionales.
 * Ordenadas por fecha de creación descendente.
 *
 * @param {Object}  [filters]
 * @param {string}  [filters.tallerId]
 * @param {boolean} [filters.activeOnly]
 * @returns {Promise<Object[]>}
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
    return rows
}

/**
 * Obtiene una chispa por código (case-insensitive).
 *
 * @param {string} code
 * @returns {Promise<Object|null>}
 */
export async function getChispa(code) {
    const { rows } = await query(
        'SELECT * FROM chispas WHERE code = $1',
        [code?.toUpperCase().trim()]
    )
    return rows[0] ?? null
}

/**
 * Estadísticas globales del estado de chispas.
 *
 * @returns {Promise<Object>}
 */
export async function getStats() {
    const { rows } = await query(`
        SELECT
            COUNT(*)                                                                         AS total,
            COUNT(*) FILTER (WHERE used = FALSE AND revoked = FALSE
                              AND (expires_at IS NULL OR expires_at > NOW()))                AS active,
            COUNT(*) FILTER (WHERE used = TRUE)                                             AS used,
            COUNT(*) FILTER (WHERE revoked = TRUE)                                          AS revoked,
            COUNT(*) FILTER (WHERE used = FALSE AND revoked = FALSE
                              AND expires_at IS NOT NULL AND expires_at <= NOW())            AS expired,
            COUNT(*) FILTER (WHERE is_demo = TRUE)                                          AS demo
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
 *
 * @param {string}      code
 * @param {string|null} [userId]
 * @returns {Promise<{ valid: boolean, record?: Object, reason?: string }>}
 */
export async function validateChispa(code, userId = null) {
    const normalized = code?.toUpperCase().trim()
    const record     = await getChispa(normalized)

    if (!record)        return { valid: false, reason: 'INVALID_CODE' }
    if (record.revoked) return { valid: false, reason: 'REVOKED' }
    if (record.used)    return { valid: false, reason: 'ALREADY_USED' }
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
        return { valid: false, reason: 'EXPIRED' }
    }

    if (userId) {
        await query(
            `UPDATE chispas SET used = TRUE, used_at = NOW(), used_by = $2 WHERE code = $1`,
            [normalized, userId]
        )
        record.used    = true
        record.used_by = userId
    }

    return { valid: true, record }
}

/**
 * Revoca una chispa permanentemente.
 *
 * @param {string} code
 * @returns {Promise<boolean>}
 */
export async function revokeChispa(code) {
    const { rows } = await query(
        `UPDATE chispas SET revoked = TRUE WHERE code = $1 RETURNING code`,
        [code?.toUpperCase().trim()]
    )
    return rows.length > 0
}