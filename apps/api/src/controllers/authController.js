/**
 * Destello API — Auth Controller
 * Login de usuario con chispa o email+password, OAuth social, refresh y logout.
 */
import jwt      from 'jsonwebtoken'
import bcrypt   from 'bcryptjs'
import { registrarLogin } from '../services/eventoService.js'
import { AppError }               from '../middleware/errorHandler.js'
import { validateChispa }         from '../services/chispaService.js'
import { query }                  from '../db/db.js'
import { verifyFirebaseToken }    from '../services/firebaseAdmin.js'
import * as bloqueoService        from '../services/bloqueoService.js'

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

      // Cuenta suspendida: se le dice, no se le miente con "contraseña
      // incorrecta". Un error genérico protege un poco más contra quien
      // defrauda a propósito, pero deja a ciegas a quien fue bloqueado por
      // error — y ese caso va a existir. La comprobación va DESPUÉS de la
      // contraseña, para no revelarle a un extraño que esa cuenta existe.
      if (usuario.acceso_bloqueado === true) {
        throw new AppError(bloqueoService.MENSAJE_ACCESO, 403, 'CUENTA_BLOQUEADA')
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

    // La chispa es un camino de entrada distinto al del correo y la
    // contraseña, así que necesita su propia revisión: si no, bloquear una
    // cuenta no serviría de nada mientras la persona conserve un código.
    if (result.record?.usuario_email) {
      const bloqueo = await bloqueoService.estadoDe(result.record.usuario_email)
      if (bloqueo.acceso) {
        throw new AppError(bloqueoService.MENSAJE_ACCESO, 403, 'CUENTA_BLOQUEADA')
      }
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