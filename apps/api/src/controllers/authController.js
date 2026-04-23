/**
 * Destello API — Auth Controller
 * Login de usuario con chispa, OAuth, refresh y logout.
 * Resplandores (validar/consumir) → resplandorController.js
 */
import jwt      from 'jsonwebtoken'
import { AppError }       from '../middleware/errorHandler.js'
import { validateChispa } from '../services/chispaService.js'

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

// POST /auth/login — login con chispa (usuario con cuenta y taller activo)
export async function loginWithCode(req, res, next) {
  try {
    const { code } = req.body
    if (!code) throw new AppError('Código de acceso requerido', 400, 'BAD_REQUEST')

    const result = await validateChispa(code)

    if (!result.valid) {
      const messages = {
        INVALID_CODE: 'Código no reconocido',
        REVOKED:      'Este código ha sido revocado',
        ALREADY_USED: 'Este código ya fue utilizado',
        EXPIRED:      'Este código ha expirado',
      }
      throw new AppError(
          messages[result.reason] ?? 'Código de acceso inválido',
          401,
          result.reason,
      )
    }

    const user  = { id: result.record.id, role: 'alumno', tallerId: result.record.taller_id }
    const token = signToken({ userId: user.id, role: user.role, tallerId: user.tallerId })

    res.json({ status: 'ok', token, user })
  } catch (err) {
    next(err)
  }
}

// GET /auth/:provider — OAuth (pendiente)
export function oauthRedirect(provider) {
  return (_req, res) => {
    res.json({ status: 'pending', message: `OAuth ${provider} pendiente de implementar` })
  }
}

// GET /auth/callback
export async function oauthCallback(req, res, next) {
  try {
    const { code } = req.query
    if (!code) throw new AppError('Código OAuth faltante', 400, 'BAD_REQUEST')
    res.redirect(`${process.env.WEB_URL}/home`)
  } catch (err) {
    next(err)
  }
}

// POST /auth/refresh
export async function refreshToken(req, res, next) {
  try {
    const { token } = req.body
    if (!token) throw new AppError('Token requerido', 400, 'BAD_REQUEST')
    const payload  = jwt.verify(token, process.env.JWT_SECRET)
    const newToken = signToken({ userId: payload.userId, role: payload.role })
    res.json({ status: 'ok', token: newToken })
  } catch (err) {
    next(new AppError('Token inválido', 401, 'INVALID_TOKEN'))
  }
}

// POST /auth/logout
export function logout(_req, res) {
  res.json({ status: 'ok', message: 'Sesión cerrada' })
}