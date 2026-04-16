/**
 * Destello API — JWT Auth Middleware
 * Protege rutas privadas. Adjunta req.user con el payload del token.
 */
import jwt from 'jsonwebtoken'
import { AppError } from './errorHandler.js'

export function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Token requerido', 401, 'UNAUTHORIZED'))
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    req.user = payload
    next()
  } catch (err) {
    next(new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN'))
  }
}
