/**
 * Destello API — OTP Service
 * Códigos de acceso de un solo uso (6 dígitos) para login/verificación por WhatsApp.
 *
 * Se guardan EN MEMORIA del proceso (Map) con TTL corto — ligero y veloz, sin
 * dependencias ni tablas. La API corre en un solo contenedor, así que basta.
 * Si algún día hay varias instancias de la API, mover este store a Redis.
 */
import crypto from 'crypto'

const store = new Map()   // whatsapp(10díg) -> { code, expiresAt, attempts, lastSentAt }

const TTL_MS       = 10 * 60 * 1000   // el código vive 10 minutos
const RESEND_MS    = 30 * 1000        // mínimo 30s entre reenvíos
const MAX_ATTEMPTS = 5                // intentos de verificación por código

function normalize(n) {
    return String(n || '').replace(/\D/g, '').slice(-10)
}

/** ¿Ya puede reenviar código este número? */
export function canResend(whatsapp) {
    const rec = store.get(normalize(whatsapp))
    if (!rec) return { ok: true }
    const wait = RESEND_MS - (Date.now() - rec.lastSentAt)
    return wait > 0 ? { ok: false, waitSeconds: Math.ceil(wait / 1000) } : { ok: true }
}

/** Genera y guarda un código nuevo. Devuelve el código (para enviarlo por WA). */
export function generate(whatsapp) {
    const key  = normalize(whatsapp)
    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
    store.set(key, { code, expiresAt: Date.now() + TTL_MS, attempts: 0, lastSentAt: Date.now() })
    return code
}

/** Verifica un código. Devuelve { ok } o { ok:false, reason }. */
export function verify(whatsapp, code) {
    const key = normalize(whatsapp)
    const rec = store.get(key)

    if (!rec)                       return { ok: false, reason: 'NO_CODE' }
    if (Date.now() > rec.expiresAt) { store.delete(key); return { ok: false, reason: 'EXPIRED' } }
    if (rec.attempts >= MAX_ATTEMPTS) { store.delete(key); return { ok: false, reason: 'TOO_MANY_ATTEMPTS' } }

    if (rec.code !== String(code || '').trim()) {
        rec.attempts += 1
        return { ok: false, reason: 'INVALID_CODE' }
    }

    store.delete(key)   // un solo uso
    return { ok: true }
}

// Limpieza periódica de códigos vencidos (evita fuga de memoria).
const sweep = setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store) if (now > v.expiresAt) store.delete(k)
}, 5 * 60 * 1000)
sweep.unref?.()
