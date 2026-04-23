/**
 * Destello API — Resplandor Controller
 *
 * Maneja todas las operaciones sobre resplandores:
 *   — Admin: crear, listar, stats, revocar
 *   — Público: validar y consumir (usado por el front en /acceso y /registro)
 */
import * as resplandorService from '../services/resplandorService.js'
import { AppError }           from '../middleware/errorHandler.js'

// ── Admin ─────────────────────────────────────────────────────────────────────

/**
 * POST /admin/resplandores
 * Genera un resplandor para un email específico.
 * Avisa si ese email ya tiene uno activo (sin bloquearlo).
 */
export async function generateResplandor(req, res, next) {
    try {
        const { email, nombre, tallerId, expiresInDays = 7 } = req.body
        if (!email) throw new AppError('email es requerido', 400, 'BAD_REQUEST')

        const existentes = await resplandorService.getResplandoresPorEmail(email)
        const yaActivo   = existentes.length > 0

        const resplandor = await resplandorService.createResplandor({
            email, nombre, tallerId, expiresInDays,
        })

        res.status(201).json({
            status:    'ok',
            resplandor,
            aviso: yaActivo
                ? `⚠️ Este email ya tenía ${existentes.length} resplandor(es) activo(s)`
                : null,
        })
    } catch (err) { next(err) }
}

/**
 * GET /admin/resplandores
 */
export async function listResplandores(_req, res, next) {
    try {
        const resplandores = await resplandorService.listResplandores()
        res.json({ status: 'ok', resplandores, total: resplandores.length })
    } catch (err) { next(err) }
}

/**
 * GET /admin/resplandores/stats
 */
export async function getResplandorStats(_req, res, next) {
    try {
        const stats = await resplandorService.getStats()
        res.json({ status: 'ok', stats })
    } catch (err) { next(err) }
}

/**
 * DELETE /admin/resplandores/:code
 */
export async function revokeResplandor(req, res, next) {
    try {
        const resplandor = await resplandorService.revokeResplandor(req.params.code)
        if (!resplandor) return next(new AppError('Resplandor no encontrado', 404, 'NOT_FOUND'))
        res.json({ status: 'ok', message: 'Resplandor revocado' })
    } catch (err) { next(err) }
}

// ── Público (usado por el frontend) ──────────────────────────────────────────

/**
 * POST /auth/resplandor/validate
 * Valida el código SIN consumirlo.
 * Devuelve el email vinculado para pre-rellenar el formulario de registro.
 */
export async function validateResplandorCode(req, res, next) {
    try {
        const { code } = req.body
        if (!code) throw new AppError('Código requerido', 400, 'BAD_REQUEST')

        const result = await resplandorService.validateResplandor(code)

        if (!result.valid) {
            const messages = {
                INVALID_CODE: 'Código no reconocido',
                REVOKED:      'Este resplandor ha sido revocado',
                ALREADY_USED: 'Este resplandor ya fue utilizado',
                EXPIRED:      'Este resplandor ha expirado',
            }
            throw new AppError(
                messages[result.reason] ?? 'Resplandor inválido',
                401,
                result.reason,
            )
        }

        res.json({
            status: 'ok',
            email:  result.record.email,
            nombre: result.record.nombre ?? null,
        })
    } catch (err) { next(err) }
}

/**
 * POST /auth/resplandor/consume
 * Marca el resplandor como usado al completar el registro.
 * Llamar SOLO después de crear la cuenta exitosamente.
 */
export async function consumeResplandorCode(req, res, next) {
    try {
        const { code, email } = req.body
        if (!code || !email) throw new AppError('code y email son requeridos', 400, 'BAD_REQUEST')

        const consumed = await resplandorService.consumeResplandor(code, email)
        if (!consumed) throw new AppError(
            'No se pudo consumir el resplandor (ya usado o inválido)',
            409,
            'CONSUME_FAILED',
        )

        res.json({ status: 'ok', message: 'Resplandor consumido. Cuenta habilitada.' })
    } catch (err) { next(err) }
}