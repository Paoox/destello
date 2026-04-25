/**
 * Destello API — Auth Controller
 * Login de usuario con chispa, registro con resplandor, OAuth, refresh y logout.
 * Resplandores (validar/consumir) → resplandorController.js
 */
import jwt      from 'jsonwebtoken'
import bcrypt   from 'bcryptjs'
import { AppError }           from '../middleware/errorHandler.js'
import { validateChispa }     from '../services/chispaService.js'
import * as resplandorService from '../services/resplandorService.js'
import { query }              from '../db/db.js'

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

/**
 * POST /auth/register
 * Crea una cuenta nueva usando un Resplandor válido.
 * Body: { email, password, nombre, resplandorCode }
 * Flujo:
 *   1. Valida que el resplandor sea válido y no esté usado
 *   2. Verifica que el email no tenga cuenta previa
 *   3. Crea el usuario con contraseña hasheada
 *   4. Consume el resplandor (lo marca como used = true)
 *   5. Devuelve JWT + datos del usuario
 */
export async function registerUser(req, res, next) {
  try {
    const { email, password, nombre, resplandorCode } = req.body

    if (!email || !password || !resplandorCode) {
      throw new AppError('email, password y resplandorCode son requeridos', 400, 'BAD_REQUEST')
    }
    if (password.length < 8) {
      throw new AppError('La contraseña debe tener al menos 8 caracteres', 400, 'BAD_REQUEST')
    }

    // 1. Validar resplandor
    const validation = await resplandorService.validateResplandor(resplandorCode)
    if (!validation.valid) {
      const messages = {
        INVALID_CODE: 'Resplandor no reconocido',
        REVOKED:      'Este resplandor ha sido revocado',
        ALREADY_USED: 'Este resplandor ya fue utilizado — si ya tienes cuenta, inicia sesión',
        EXPIRED:      'Este resplandor ha expirado',
      }
      throw new AppError(
          messages[validation.reason] ?? 'Resplandor inválido',
          401,
          validation.reason,
      )
    }

    // 2. Verificar que no exista cuenta con ese email
    const { rows: existing } = await query(
        `SELECT id FROM usuarios WHERE email = $1`,
        [email.toLowerCase().trim()]
    )
    if (existing.length > 0) {
      throw new AppError(
          'Ya existe una cuenta con ese correo. Inicia sesión.',
          409,
          'EMAIL_ALREADY_EXISTS',
      )
    }

    // 3. Crear usuario con contraseña hasheada
    const hash = await bcrypt.hash(password, 12)
    const { rows } = await query(
        `INSERT INTO usuarios (email, nombre, password, estado)
       VALUES ($1, $2, $3, 'activo')
       RETURNING id, email, nombre, estado, created_at`,
        [email.toLowerCase().trim(), nombre?.trim() || null, hash]
    )
    const user = rows[0]

    // 4. Consumir resplandor
    await resplandorService.consumeResplandor(resplandorCode, user.email)

    // 5. Emitir JWT
    const token = signToken({ userId: user.id, role: 'alumno' })

    res.status(201).json({
      status: 'ok',
      token,
      user: {
        id:     user.id,
        email:  user.email,
        nombre: user.nombre,
        role:   'alumno',
      },
    })
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