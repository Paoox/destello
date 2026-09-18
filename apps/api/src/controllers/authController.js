/**
 * Destello API — Auth Controller
 * OAuth social (Google), login por WhatsApp/OTP (ver phoneAuthController.js),
 * refresh y logout.
 */
import jwt      from 'jsonwebtoken'
import { registrarLogin } from '../services/eventoService.js'
import { AppError }               from '../middleware/errorHandler.js'
import { query }                  from '../db/db.js'
import { verifyFirebaseToken }    from '../services/firebaseAdmin.js'
import * as bloqueoService        from '../services/bloqueoService.js'

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

/**
 * POST /auth/social
 * Login con proveedor social (Google) via Firebase.
 * Body: { idToken, provider }
 *
 * Flujo:
 *   1. Verifica el idToken con Firebase Admin SDK
 *   2. Extrae el email del token (verificado por Google)
 *   3. Busca al usuario en la BD por ese email
 *   4. Si existe y está activo → emite JWT de Destello
 *   5. Si no existe → error claro indicando que use el correo con el que se registró
 */
export async function loginWithSocial(req, res, next) {
  try {
    const { idToken, provider = 'google' } = req.body

    if (!idToken) {
      throw new AppError('idToken requerido', 400, 'BAD_REQUEST')
    }

    // 1. Verificar token con Firebase Admin
    let firebaseUser
    try {
      firebaseUser = await verifyFirebaseToken(idToken)
    } catch (fbErr) {
      console.error('[auth/social] Firebase verifyIdToken falló:', fbErr?.code, '-', fbErr?.message)
      throw new AppError('Token de Google inválido o expirado', 401, 'INVALID_TOKEN')
    }

    const emailNorm = firebaseUser.email?.toLowerCase().trim()
    if (!emailNorm) {
      throw new AppError('No pudimos obtener el correo de tu cuenta de Google', 400, 'NO_EMAIL')
    }

    // 2. Buscar usuario en la BD
    const { rows } = await query(
        `SELECT id, email, nombre, apellido, whatsapp, estado, acceso_bloqueado
           FROM usuarios WHERE email = $1`,
        [emailNorm]
    )

    if (!rows.length) {
      throw new AppError(
          `No encontramos una cuenta con el correo ${emailNorm}. Verifica que uses el mismo correo con el que te registraste en Destello.`,
          404,
          'USER_NOT_FOUND',
      )
    }

    const usuario = rows[0]

    if (usuario.acceso_bloqueado === true) {
      throw new AppError(bloqueoService.MENSAJE_ACCESO, 403, 'CUENTA_BLOQUEADA')
    }

    if (usuario.estado !== 'activo') {
      throw new AppError('Tu cuenta no está activa. Contacta a soporte.', 403, 'ACCOUNT_INACTIVE')
    }

    // 3. Emitir JWT de Destello
    const token = signToken({ userId: usuario.id, role: 'alumno' })

    // Medición: primer_login_at / ultimo_login_at / total_logins.
    // Va sin await a propósito — que la métrica no le meta latencia al login,
    // y si falla, el login ya es válido de todos modos.
    registrarLogin(usuario.email, provider || 'google')

    return res.json({
      status: 'ok',
      token,
      user: {
        id:       usuario.id,
        email:    usuario.email,
        nombre:   usuario.nombre,
        apellido: usuario.apellido,
        whatsapp: usuario.whatsapp,   // el front decide si pedir onboarding
        role:     'alumno',
        provider,
      },
    })
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