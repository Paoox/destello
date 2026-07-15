/**
 * Destello Web — Public API Service
 * Endpoints públicos (sin autenticación).
 * Usados en landing, /acceso, /habitat y registro.
 */

// Siempre por el proxy `/api` (mismo origen) para evitar CORS:
//  · Producción → vercel.json reescribe /api/* → https://api.destello.courses
//  · Dev local  → vite.config.js proxya /api/* al túnel
// (Igual que adminApi.js, que ya funciona así.)
const BASE = '/api'

async function handleResponse(res) {
    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`)
    return data
}

// ── Resplandores ──────────────────────────────────────────────────────────────

/**
 * Valida un código de resplandor sin consumirlo.
 * Devuelve { email, nombre } para pre-rellenar el form de registro.
 */
export async function apiValidarResplandor(code) {
    const res = await fetch(`${BASE}/auth/resplandor/validate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: code.toUpperCase().trim() }),
    })
    return handleResponse(res)
}

/**
 * Consume el resplandor al completar el registro de cuenta.
 */
export async function apiConsumirResplandor(code, email) {
    const res = await fetch(`${BASE}/auth/resplandor/consume`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code, email }),
    })
    return handleResponse(res)
}

// ── Chispas ───────────────────────────────────────────────────────────────────

/**
 * Valida un código de chispa SIN consumirlo.
 * Devuelve { status, record } donde record trae { tallerNombre, tallerId, expiresAt, ... }.
 * Se usa en el Home para previsualizar el taller antes de desbloquearlo.
 */
export async function apiValidarChispa(code) {
    const res = await fetch(`${BASE}/chispas/validate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ code: code.toUpperCase().trim() }),
    })
    return handleResponse(res)
}

// ── Talleres ──────────────────────────────────────────────────────────────────

/**
 * Lista los talleres activos (públicos, sin auth).
 */
export async function apiListTalleres() {
    const res = await fetch(`${BASE}/tallers`)
    return handleResponse(res)
}

/**
 * Registra interés en un taller → lista de espera.
 * @param {string} tallerId
 * @param {{ email: string, nombre?: string, whatsapp?: string }} datos
 */
export async function apiUnirseListaEspera(tallerId, datos) {
    const res = await fetch(`${BASE}/tallers/${tallerId}/join`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(datos),
    })
    return handleResponse(res)
}