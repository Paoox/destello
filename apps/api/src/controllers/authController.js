/**
 * Destello API — Auth Controller
 * Login de usuario con chispa, registro con resplandor, OAuth social, refresh y logout.
 * Resplandores (validar/consumir) → resplandorController.js
 */
import jwt      from 'jsonwebtoken'
import bcrypt   from 'bcryptjs'
import { AppError }               from '../middleware/errorHandler.js'
import { validateChispa }         from '../services/chispaService.js'
import * as resplandorService     from '../services/resplandorService.js'
import { query }                  from '../db/db.js'
import { verifyFirebaseToken }    from '../services/firebaseAdmin.js'

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  })
}

/**
 * POST /auth/login
 * Maneja dos flujos según el body que llega:
 *   - { email, password }  → login con credenciales de cuenta (usuario registrado)
 *   - { code }             → login con Chispa (acceso directo a taller)
 */
export async function loginWithCode(req, res, next) {
  try {
    const { email, password, code } = req.body

    // ── Flujo A: email + contraseña ───────────────────────────────────────────
    if (email && password) {
      const { rows } = await query(
          `SELECT * FROM usuarios WHERE email = $1 AND estado = 'activo'`,
          [email.toLowerCase().trim()]
      )
      const usuario = rows[0]

      if (!usuario || !usuario.password) {
        throw new AppError('Correo o contraseña incorrectos', 401, 'INVALID_CREDENTIALS')
      }

      const match = await bcrypt.compare(password, usuario.password)
      if (!match) {
        throw new AppError('Correo o contraseña incorrectos', 401, 'INVALID_CREDENTIALS')
      }

      const token = signToken({ userId: usuario.id, role: 'alumno' })
      return res.json({
        status: 'ok',
        token,
        user: {
          id:     usuario.id,
          email:  usuario.email,
          nombre: usuario.nombre,
          role:   'alumno',
        },
      })
    }

    // ── Flujo B: Chispa ───────────────────────────────────────────────────────
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
    } catch {
      throw new AppError('Token de Google inválido o expirado', 401, 'INVALID_TOKEN')
    }

    const emailNorm = firebaseUser.email?.toLowerCase().trim()
    if (!emailNorm) {
      throw new AppError('No pudimos obtener el correo de tu cuenta de Google', 400, 'NO_EMAIL')
    }

    // 2. Buscar usuario en la BD
    const { rows } = await query(
        `SELECT id, email, nombre, estado FROM usuarios WHERE email = $1`,
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

    if (usuario.estado !== 'activo') {
      throw new AppError('Tu cuenta no está activa. Contacta a soporte.', 403, 'ACCOUNT_INACTIVE')
    }

    // 3. Emitir JWT de Destello
    const token = signToken({ userId: usuario.id, role: 'alumno' })

    return res.json({
      status: 'ok',
      token,
      user: {
        id:       usuario.id,
        email:    usuario.email,
        nombre:   usuario.nombre,
        role:     'alumno',
        provider,
      },
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /auth/register
 * Crea una cuenta nueva usando un Resplandor válido.
 * Body: { email, password, nombre, resplandorCode }
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

    // 2. Verificar si ya existe cuenta con ese email
    const { rows: existing } = await query(
        `SELECT id, password FROM usuarios WHERE email = $1`,
        [email.toLowerCase().trim()]
    )

    let user

    if (existing.length > 0) {
      if (existing[0].password) {
        throw new AppError(
            'Ya existe una cuenta con ese correo. Inicia sesión.',
            409,
            'EMAIL_ALREADY_EXISTS',
        )
      }
      // Sin contraseña → completar registro
      const hash = await bcrypt.hash(password, 12)
      const { rows } = await query(
          `UPDATE usuarios
           SET nombre   = COALESCE($2, nombre),
               password = $3,
               estado   = 'activo'
           WHERE email = $1
           RETURNING id, email, nombre, estado`,
          [email.toLowerCase().trim(), nombre?.trim() || null, hash]
      )
      user = rows[0]
    } else {
      // Usuario nuevo
      const hash = await bcrypt.hash(password, 12)
      const { rows } = await query(
          `INSERT INTO usuarios (email, nombre, password, estado)
           VALUES ($1, $2, $3, 'activo')
           RETURNING id, email, nombre, estado`,
          [email.toLowerCase().trim(), nombre?.trim() || null, hash]
      )
      user = rows[0]
    }

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