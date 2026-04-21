/**
 * Destello API — Middleware: authenticateAdmin
 * Verifica que el request lleve un adminToken válido (rol superadmin).
 * Se aplica en las rutas protegidas del router /admin.
 */
import { verifyAdminToken } from '../services/adminAuthService.js'
import { AppError }         from './errorHandler.js'

export function authenticateAdmin(req, res, next) {
    try {
        const authHeader = req.headers['authorization'] ?? ''
        const token      = authHeader.replace('Bearer ', '').trim()

        if (!token) throw new AppError('Token de admin requerido', 401, 'UNAUTHORIZED')

        const payload = verifyAdminToken(token)
        if (payload.role !== 'superadmin') {
            throw new AppError('Acceso denegado', 403, 'FORBIDDEN')
        }

        req.admin = payload
        next()
    } catch (err) {
        next(new AppError('Token de admin inválido o expirado', 401, 'INVALID_ADMIN_TOKEN'))
    }
}