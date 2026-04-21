/**
 * Destello API — Admin Controller
 * Solo HTTP: lee req, llama servicio, escribe res.
 */
import { verifyAdminPassword, signAdminToken } from '../services/adminAuthService.js'
import { AppError } from '../middleware/errorHandler.js'

/**
 * POST /admin/login
 * Body: { password }
 * Response: { status, adminToken }
 */
export async function adminLogin(req, res, next) {
    try {
        const { password } = req.body
        if (!password) throw new AppError('Contraseña requerida', 400, 'BAD_REQUEST')

        const valid = await verifyAdminPassword(password)
        if (!valid) throw new AppError('Contraseña incorrecta', 401, 'UNAUTHORIZED')

        const adminToken = signAdminToken()
        res.json({ status: 'ok', adminToken })
    } catch (err) {
        next(err)
    }
}