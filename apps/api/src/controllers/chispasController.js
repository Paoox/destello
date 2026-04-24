/**
 * Destello API — Chispas Controller
 * ─────────────────────────────────────────────────────────────────────────────
 * Handlers HTTP para el módulo de chispas.
 * Este archivo SOLO maneja la capa HTTP: validar req, llamar al servicio,
 * formatear res. Toda la lógica de negocio vive en chispaService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import * as chispaService from '../services/chispaService.js'
import { AppError }       from '../middleware/errorHandler.js'

// Mapa de razones de fallo → mensajes legibles para el usuario
const REASON_MESSAGES = {
    INVALID_CODE:  'Código no reconocido. Verifica que lo hayas escrito correctamente.',
    REVOKED:       'Este código ha sido revocado.',
    ALREADY_USED:  'Este código ya fue utilizado.',
    EXPIRED:       'Este código ha expirado. Contacta al organizador.',
}

// ── Rutas de administración (requieren JWT) ───────────────────────────────────

/**
 * POST /admin/chispas
 * Genera una nueva chispa para un taller dado.
 *
 * Body: { tallerId, tallerNombre?, expiresInDays?, isDemo?, prefix?,
 *         usuarioNombre?, usuarioEmail?, usuarioWa? }
 * Response: { status, chispa }
 */
export async function generateChispa(req, res, next) {
    try {
        const {
            tallerId, tallerNombre, expiresInDays, prefix, isDemo,
            usuarioNombre, usuarioEmail, usuarioWa,
        } = req.body

        if (!tallerId) {
            throw new AppError('tallerId es requerido', 400, 'BAD_REQUEST')
        }

        // ← await aquí: el servicio es async (PostgreSQL)
        const record = await chispaService.createChispa({
            tallerId,
            tallerNombre:  tallerNombre  || null,
            createdBy:     req.user?.userId ?? 'admin',
            expiresInDays: expiresInDays !== undefined ? expiresInDays : 30,
            prefix,
            isDemo:        Boolean(isDemo),
            usuarioNombre: usuarioNombre || null,
            usuarioEmail:  usuarioEmail  || null,
            usuarioWa:     usuarioWa     || null,
        })

        res.status(201).json({ status: 'ok', chispa: record })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /admin/chispas/batch
 * Genera N chispas de golpe.
 *
 * Body: { tallerId, quantity, expiresInDays?, prefix? }
 * Response: { status, chispas, total }
 */
export async function generateBatch(req, res, next) {
    try {
        const { tallerId, quantity = 1, expiresInDays, prefix } = req.body
        if (!tallerId)          throw new AppError('tallerId es requerido', 400, 'BAD_REQUEST')
        if (quantity < 1 || quantity > 500) {
            throw new AppError('quantity debe estar entre 1 y 500', 400, 'BAD_REQUEST')
        }

        const chispas = []
        for (let i = 0; i < quantity; i++) {
            // ← await en cada iteración
            chispas.push(await chispaService.createChispa({
                tallerId,
                createdBy:    req.user?.userId ?? 'admin',
                expiresInDays: expiresInDays ?? 30,
                prefix,
            }))
        }

        res.status(201).json({ status: 'ok', chispas, total: chispas.length })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /admin/chispas
 * Lista todas las chispas con filtros opcionales.
 *
 * Query: ?tallerId=&activeOnly=true
 * Response: { status, chispas, total }
 */
export async function listChispas(req, res, next) {
    try {
        const { tallerId, activeOnly } = req.query
        const chispas = await chispaService.listChispas({
            tallerId,
            activeOnly: activeOnly === 'true',
        })
        res.json({ status: 'ok', chispas, total: chispas.length })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /admin/chispas/stats
 * Estadísticas del estado global de chispas.
 *
 * Response: { status, stats }
 */
export async function getStats(_req, res, next) {
    try {
        const stats = await chispaService.getStats()
        res.json({ status: 'ok', stats })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /admin/chispas/:code
 * Obtiene el detalle de una chispa por código.
 *
 * Response: { status, chispa }
 */
export async function getChispa(req, res, next) {
    try {
        const record = await chispaService.getChispa(req.params.code)
        if (!record) return next(new AppError('Chispa no encontrada', 404, 'NOT_FOUND'))
        res.json({ status: 'ok', chispa: record })
    } catch (err) {
        next(err)
    }
}

/**
 * DELETE /admin/chispas/:code
 * Revoca una chispa. No la borra — queda en el historial como revocada.
 *
 * Response: { status, message }
 */
export async function revokeChispa(req, res, next) {
    try {
        const ok = await chispaService.revokeChispa(req.params.code)
        if (!ok) return next(new AppError('Chispa no encontrada', 404, 'NOT_FOUND'))
        res.json({ status: 'ok', message: `Chispa ${req.params.code} revocada exitosamente` })
    } catch (err) {
        next(err)
    }
}

// ── Ruta pública (sin JWT) ────────────────────────────────────────────────────

/**
 * POST /chispas/validate
 * Valida un código ingresado por el usuario.
 *
 * Body: { code }
 * Response: { status, record } | AppError 401
 */
export async function validateChispa(req, res, next) {
    try {
        const { code } = req.body
        if (!code) throw new AppError('Código requerido', 400, 'BAD_REQUEST')

        const result = await chispaService.validateChispa(code)

        if (!result.valid) {
            const message = REASON_MESSAGES[result.reason] ?? 'Código inválido'
            throw new AppError(message, 401, result.reason)
        }

        res.json({ status: 'ok', record: result.record })
    } catch (err) {
        next(err)
    }
}