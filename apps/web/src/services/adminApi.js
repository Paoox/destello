/**
 * Destello Web — Admin API Service
 * Todas las llamadas HTTP al backend de admin.
 * Recibe el adminToken como parámetro → sin acoplamiento a store.
 */

function authHeaders(adminToken) {
    return {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${adminToken}`,
    }
}

async function handleResponse(res) {
    const data = await res.json()
    if (!res.ok) throw new Error(data.message ?? `Error ${res.status}`)
    return data
}

/**
 * Genera una chispa individual.
 * @param {string} adminToken
 * @param {{ tallerId: string, expiresInDays: number, usuarioNombre?: string, usuarioWa?: string, prefix?: string }} body
 * @returns {Promise<{ status: string, chispa: object }>}
 */
export async function apiGenerateChispa(adminToken, body) {
    const res = await fetch('/api/admin/chispas', {
        method:  'POST',
        headers: authHeaders(adminToken),
        body:    JSON.stringify(body),
    })
    return handleResponse(res)
}

/**
 * Genera N chispas de golpe.
 * @param {string} adminToken
 * @param {{ tallerId: string, quantity: number, expiresInDays: number }} body
 * @returns {Promise<{ status: string, chispas: object[], total: number }>}
 */
export async function apiGenerateBatch(adminToken, body) {
    const res = await fetch('/api/admin/chispas/batch', {
        method:  'POST',
        headers: authHeaders(adminToken),
        body:    JSON.stringify(body),
    })
    return handleResponse(res)
}

/**
 * Lista todas las chispas con filtros opcionales.
 * @param {string} adminToken
 * @param {{ tallerId?: string, activeOnly?: boolean }} filters
 */
export async function apiListChispas(adminToken, filters = {}) {
    const params = new URLSearchParams()
    if (filters.tallerId)   params.set('tallerId',   filters.tallerId)
    if (filters.activeOnly) params.set('activeOnly', 'true')

    const res = await fetch(`/api/admin/chispas?${params}`, {
        headers: authHeaders(adminToken),
    })
    return handleResponse(res)
}

/**
 * Obtiene estadísticas globales.
 * @param {string} adminToken
 */
export async function apiGetStats(adminToken) {
    const res = await fetch('/api/admin/chispas/stats', {
        headers: authHeaders(adminToken),
    })
    return handleResponse(res)
}

/**
 * Revoca una chispa.
 * @param {string} adminToken
 * @param {string} code
 */
export async function apiRevokeChispa(adminToken, code) {
    const res = await fetch(`/api/admin/chispas/${code}`, {
        method:  'DELETE',
        headers: authHeaders(adminToken),
    })
    return handleResponse(res)
}