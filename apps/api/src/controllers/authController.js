/**
 * Destello API — Auth Controller
 * Lógica de autenticación separada de las rutas.
 * Cada función es exportada individualmente → fácil de testear.
 */
import jwt      from 'jsonwebtoken'
import bcrypt   from 'bcryptjs'
import { AppError }      from '../middleware/errorHandler.js'
import { validateChispa } from '../services/chispaService.js'

// Generar JWT
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

// POST /auth/login — login con chispa (código de acceso de pago)
export async function loginWithCode(req, res, next) {
  try {
    const { code } = req.body
    if (!code) throw new AppError('Código de acceso requerido', 400, 'BAD_REQUEST')

    // ── Validar chispa contra el servicio ─────────────────────────────────
    // Se pasa un userId temporal para marcarla como usada al canjear.
    // En producción el userId real llegará después de crear el usuario en DB.
    const tempUserId = `pending-${Date.now()}`
    const result     = validateChispa(code, tempUserId)

    if (!result.valid) {
      const messages = {
        INVALID_CODE:  'Código no reconocido',
        REVOKED:       'Este código ha sido revocado',
        ALREADY_USED:  'Este código ya fue utilizado',
        EXPIRED:       'Este código ha expirado',
      }
      throw new AppError(
          messages[result.reason] ?? 'Código de acceso inválido',
          401,
          result.reason,
      )
    }

    // ── Emitir JWT con información del taller al que da acceso ────────────
    const user  = { id: tempUserId, role: 'alumno', tallerId: result.record.tallerId }
    const token = signToken({ userId: user.id, role: user.role, tallerId: user.tallerId })

    res.json({ status: 'ok', token, user })
  } catch (err) {
    next(err)
  }
}

// GET /auth/:provider — redirect OAuth
export function oauthRedirect(provider) {
  return (_req, res) => {
    // TODO: implementar OAuth real con passport.js o Auth0
    res.json({ status: 'pending', message: `OAuth ${provider} pendiente de implementar` })
  }
}

// GET /auth/callback — callback OAuth
export async function oauthCallback(req, res, next) {
  try {
    // TODO: intercambiar code por token con el provider
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
  // JWT es stateless — el cliente elimina el token
  res.json({ status: 'ok', message: 'Sesión cerrada' })
}