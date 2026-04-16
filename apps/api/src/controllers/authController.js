/**
 * Destello API — Auth Controller
 * Lógica de autenticación separada de las rutas.
 * Cada función es exportada individualmente → fácil de testear.
 */
import jwt      from 'jsonwebtoken'
import bcrypt   from 'bcryptjs'
import { AppError } from '../middleware/errorHandler.js'

// Generar JWT
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

// POST /auth/login — login con código de pago
export async function loginWithCode(req, res, next) {
  try {
    const { code } = req.body
    if (!code) throw new AppError('Código de acceso requerido', 400, 'BAD_REQUEST')

    // TODO: validar código contra DB
    // Por ahora: mock de validación
    if (code !== process.env.DEMO_CODE && code !== 'DESTELLO2026') {
      throw new AppError('Código de acceso inválido', 401, 'INVALID_CODE')
    }

    const user = { id: 'mock-001', name: 'Demo User', role: 'alumno' }
    const token = signToken({ userId: user.id, role: user.role })

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
