/**
 * Destello API — JWT Auth Middleware
 * Protege rutas privadas. Adjunta req.user con el payload del token.
 */
import jwt from 'jsonwebtoken'
import { AppError } from './errorHandler.js'
import { estadoDePorId, MENSAJE_ACCESO } from '../services/bloqueoService.js'

export async function authenticate(req, _res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AppError('Token requerido', 401, 'UNAUTHORIZED'))
  }

  const token = authHeader.slice(7)
  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return next(new AppError('Token inválido o expirado', 401, 'INVALID_TOKEN'))
  }

  // ── El bloqueo se revisa AQUÍ, no solo en el login ────────────────────────
  //
  // Un JWT ya emitido dura 7 días. Si el bloqueo solo se revisara al entrar,
  // bloquear a alguien que ya tiene la sesión abierta no haría absolutamente
  // nada durante una semana — justo cuando más urge que sí haga algo.
  //
  // El costo está acotado: `estadoDePorId` lee de un caché de 60 s que se
  // borra en el momento del bloqueo, así que esto NO es una consulta a
  // Supabase en cada petición.
  //
  // Si la revisión truena (base caída, por ejemplo), se deja pasar. Dejar
  // fuera a TODOS los alumnos por una falla de infraestructura es mucho peor
  // que dejar entrar un minuto más a quien está bloqueado.
  try {
    const bloqueo = await estadoDePorId(payload.userId)
    if (bloqueo.acceso) {
      return next(new AppError(MENSAJE_ACCESO, 403, 'CUENTA_BLOQUEADA'))
    }
  } catch (err) {
    console.error('[authenticate] no se pudo revisar el bloqueo:', err.message)
  }

  req.user = payload
  next()
}
