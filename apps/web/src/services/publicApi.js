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
    if (!res.ok) {
        // El `code` de la API viaja con el error para que quien lo atrape pueda
        // distinguir casos legítimos (un taller lleno) de fallas de verdad, sin
        // tener que adivinar leyendo el texto del mensaje.
        const err = new Error(data.message ?? `Error ${res.status}`)
        err.code   = data.code ?? null
        err.status = res.status
        err.data   = data
        throw err
    }
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
// ── Certificados ──────────────────────────────────────────────────────────────

/**
 * Verifica un certificado por su folio. Es el endpoint al que lleva el QR
 * impreso en el diploma, y es público a propósito: quien recibe un certificado
 * tiene que poder comprobarlo sin tener cuenta en Destello.
 *
 * Devuelve `{ valido: true, certificado }`, o `{ valido: false }` si está
 * anulado. Si el folio no existe la API responde 404 y `handleResponse` lanza
 * un error con `.status = 404` — la pantalla lo distingue de una falla real:
 * "no existe" es una respuesta, "no se pudo consultar" es un problema, y
 * confundirlos haría pasar por falso un certificado bueno.
 *
 * ⚠️ Nunca devuelve el correo del alumno.
 */
export async function apiVerificarCertificado(folio) {
    const res = await fetch(`${BASE}/certificados/${encodeURIComponent(String(folio ?? '').trim())}`)
    return handleResponse(res)
}
