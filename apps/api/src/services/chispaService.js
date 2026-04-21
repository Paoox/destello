/**
 * Destello API — Chispa Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica PURA de negocio para chispas (códigos de acceso de pago).
 * Sin dependencias de Express → se puede testear de forma completamente aislada.
 *
 * En producción: reemplazar el Map en memoria por queries a la tabla
 * `chispas` en PostgreSQL (mismas firmas de función, solo cambiar el body).
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Flujo completo:
 *   Admin genera chispa → código viaja al comprador (email / whatsapp)
 *   → Comprador la ingresa en PageLogin → loginWithCode llama validateChispa
 *   → Si válida: emite JWT y da acceso al taller
 */

import crypto from 'node:crypto'

// ── Storage en memoria ────────────────────────────────────────────────────────
// TODO (producción): reemplazar por pg pool y tabla `chispas`
//   CREATE TABLE chispas (
//     code         TEXT PRIMARY KEY,
//     taller_id    TEXT NOT NULL,
//     created_by   TEXT NOT NULL,
//     created_at   TIMESTAMPTZ DEFAULT NOW(),
//     expires_at   TIMESTAMPTZ,
//     used         BOOLEAN DEFAULT FALSE,
//     used_by      TEXT,
//     revoked      BOOLEAN DEFAULT FALSE
//   );
const store = new Map() // Map<code, ChispaRecord>

// ── Tipos (JSDoc) ─────────────────────────────────────────────────────────────
/**
 * @typedef {Object} ChispaRecord
 * @property {string}      code         Código único, ej: DEST-A1B2-C3D4
 * @property {string}      tallerId     ID del taller al que da acceso
 * @property {string}      createdBy    ID del admin que la generó
 * @property {Date}        createdAt
 * @property {Date|null}   expiresAt    null = sin expiración
 * @property {boolean}     used         true si ya fue canjeada
 * @property {string|null} usedBy       userId que la canjeó
 * @property {boolean}     revoked      true si fue revocada manualmente
 * @property {boolean}     isDemo       true si fue regalada como demo/cortesía
 */

// ── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Genera un segmento de 4 caracteres alfanuméricos en mayúsculas.
 * Usa crypto.randomBytes → seguridad criptográfica real.
 * @returns {string} ej: "A1B2"
 */
function randomSegment() {
    // 3 bytes → 6 chars hex → tomamos 4
    return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)
}

/**
 * Construye el código completo: PREFIX-XXXX-XXXX
 * @param {string} prefix  Ej: 'DEST', 'ZEN', 'GAST'
 * @returns {string}       Ej: 'DEST-A1B2-C3D4'
 */
function buildCode(prefix = 'DEST') {
    return `${prefix}-${randomSegment()}-${randomSegment()}`
}

/**
 * Garantiza que el código sea único dentro del store.
 * Reintenta en la (muy improbable) colisión.
 * @param {string} prefix
 * @returns {string}
 */
function uniqueCode(prefix) {
    let code
    let attempts = 0
    do {
        code = buildCode(prefix)
        attempts++
        if (attempts > 10) throw new Error('No se pudo generar código único')
    } while (store.has(code))
    return code
}

// ── API pública del servicio ──────────────────────────────────────────────────

/**
 * Crea y almacena una nueva chispa.
 *
 * @param {Object}      opts
 * @param {string}      opts.tallerId        ID del taller (requerido)
 * @param {string}      opts.createdBy       ID del admin que la crea
 * @param {number|null} opts.expiresInDays   Días hasta expiración (null = sin límite)
 * @param {string}      [opts.prefix]        Prefijo del código (default: 'DEST')
 * @returns {ChispaRecord}
 */
export function createChispa({ tallerId, createdBy, expiresInDays = 30, prefix = 'DEST', isDemo = false }) {
    if (!tallerId)  throw new Error('tallerId es requerido')
    if (!createdBy) throw new Error('createdBy es requerido')

    const code      = uniqueCode(prefix.toUpperCase())
    // expiresInDays === null → sin vigencia (acceso permanente)
    const expiresAt = expiresInDays != null
        ? new Date(Date.now() + expiresInDays * 86_400_000)
        : null

    /** @type {ChispaRecord} */
    const record = {
        code,
        tallerId,
        createdBy,
        createdAt: new Date(),
        expiresAt,
        used:    false,
        usedBy:  null,
        revoked: false,
        isDemo:  Boolean(isDemo),
    }

    store.set(code, record)
    return record
}

/**
 * Valida una chispa.
 * Si es válida Y se proporciona userId, la marca como usada (one-time use).
 *
 * @param {string}      code     Código a validar (case-insensitive)
 * @param {string|null} [userId] Si se pasa, la chispa queda marcada como usada
 * @returns {{ valid: boolean, record?: ChispaRecord, reason?: string }}
 *
 * Razones de fallo posibles:
 *   'INVALID_CODE'  → no existe en el store
 *   'REVOKED'       → fue revocada manualmente
 *   'ALREADY_USED'  → ya fue canjeada
 *   'EXPIRED'       → pasó la fecha de expiración
 */
export function validateChispa(code, userId = null) {
    const normalized = code?.toUpperCase().trim()
    const record     = store.get(normalized)

    if (!record)                                      return { valid: false, reason: 'INVALID_CODE' }
    if (record.revoked)                               return { valid: false, reason: 'REVOKED' }
    if (record.used)                                  return { valid: false, reason: 'ALREADY_USED' }
    if (record.expiresAt && record.expiresAt < new Date()) {
        return { valid: false, reason: 'EXPIRED' }
    }

    // Marcar como usada si se proporciona userId
    if (userId) {
        record.used   = true
        record.usedBy = userId
        store.set(normalized, record)
    }

    return { valid: true, record }
}

/**
 * Revoca una chispa permanentemente (no la elimina, queda en el historial).
 *
 * @param {string} code
 * @returns {boolean} true si existía y fue revocada, false si no existía
 */
export function revokeChispa(code) {
    const normalized = code?.toUpperCase().trim()
    const record     = store.get(normalized)
    if (!record) return false

    record.revoked = true
    store.set(normalized, record)
    return true
}

/**
 * Lista todas las chispas con filtros opcionales.
 * Ordenadas por fecha de creación descendente (más reciente primero).
 *
 * @param {Object}  [filters]
 * @param {string}  [filters.tallerId]    Filtra por taller
 * @param {boolean} [filters.activeOnly]  Solo las no usadas y no revocadas
 * @returns {ChispaRecord[]}
 */
export function listChispas({ tallerId, activeOnly } = {}) {
    let records = [...store.values()]

    if (tallerId)   records = records.filter(r => r.tallerId === tallerId)
    if (activeOnly) records = records.filter(r => !r.used && !r.revoked)

    return records.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * Obtiene una chispa por código exacto.
 *
 * @param {string} code
 * @returns {ChispaRecord|null}
 */
export function getChispa(code) {
    return store.get(code?.toUpperCase().trim()) ?? null
}

/**
 * Elimina una chispa del store (solo para tests o datos de prueba).
 * En producción: usar revokeChispa en su lugar.
 *
 * @param {string} code
 * @returns {boolean}
 */
export function deleteChispa(code) {
    return store.delete(code?.toUpperCase().trim())
}

/**
 * Retorna estadísticas básicas del store.
 * Útil para un dashboard de administración.
 *
 * @returns {{ total: number, active: number, used: number, revoked: number, expired: number }}
 */
export function getStats() {
    const now     = new Date()
    const records = [...store.values()]

    return {
        total:   records.length,
        active:  records.filter(r => !r.used && !r.revoked && (!r.expiresAt || r.expiresAt > now)).length,
        used:    records.filter(r => r.used).length,
        revoked: records.filter(r => r.revoked).length,
        expired: records.filter(r => !r.used && !r.revoked && r.expiresAt && r.expiresAt <= now).length,
        demo:    records.filter(r => r.isDemo).length,
    }
}