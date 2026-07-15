/**
 * Destello API — Users Routes
 * GET  /users/me        → perfil del usuario autenticado
 * PUT  /users/me        → actualizar perfil
 * GET  /users/me/progress → progreso en talleres
 */
import { Router } from 'express'
import { query } from '../db/db.js'
import * as chispaService from '../services/chispaService.js'
import * as referralService from '../services/referralService.js'

const router = Router()

/** Helper: obtiene el email del usuario autenticado a partir del userId del JWT. */
async function emailDelUsuario(userId) {
    const { rows } = await query('SELECT email FROM usuarios WHERE id = $1', [userId])
    return rows[0]?.email ?? null
}

// Perfil del usuario autenticado con datos reales de la BD
// (incluye estrellas y código de referido).
router.get('/me', async (req, res, next) => {
  try {
    // Genera el código de referido si el usuario aún no tiene uno.
    await referralService.ensureCodigoReferido(req.user.userId)
    const { rows } = await query(
      `SELECT id, email, nombre, apellido, whatsapp, estado,
              estrellas, codigo_referido, referido_por
       FROM usuarios
       WHERE id = $1`,
      [req.user.userId]
    )
    // Si por alguna razón no está en BD, devolvemos al menos el payload del token.
    res.json({ status: 'ok', user: rows[0] ?? req.user })
  } catch (err) {
    next(err)
  }
})

router.put('/me', (req, res) => {
  // TODO: actualizar perfil en DB
  res.json({ status: 'ok', message: 'Perfil actualizado' })
})

router.get('/me/progress', (req, res) => {
  // TODO: consultar progreso real desde DB
  res.json({
    status: 'ok',
    progress: [
      { tallerId: '1', completado: 65, ultimaClase: '2026-04-14' },
    ]
  })
})

// ── Talleres desbloqueados del usuario (chispas canjeadas) ──
// Devuelve cada taller con su estado (proximo/en_curso/concluido),
// si la clase es accesible hoy, y la ventana de material (30 días).
router.get('/me/talleres', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.json({ status: 'ok', talleres: [] })
    const talleres = await chispaService.getTalleresDelUsuario(email)
    res.json({ status: 'ok', talleres })
  } catch (err) {
    next(err)
  }
})

// ── Canjear una chispa a nombre del usuario con sesión ──
// Body: { code }. Marca la chispa como usada y la liga al usuario.
router.post('/me/canjear', async (req, res, next) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ status: 'error', reason: 'BAD_REQUEST', message: 'Código requerido' })

    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', reason: 'USER_NOT_FOUND', message: 'Usuario no encontrado' })

    const result = await chispaService.canjearChispa(code, email)
    if (!result.ok) {
      const msg = {
        INVALID_CODE: 'Ese código no existe',
        REVOKED:      'Esa chispa fue revocada',
        ALREADY_USED: 'Esa chispa ya fue canjeada',
        EXPIRED:      'Esa chispa ya venció',
        NOT_OWNER:    'Esa chispa pertenece a otra cuenta',
      }[result.reason] ?? 'No se pudo canjear la chispa'
      return res.status(409).json({ status: 'error', reason: result.reason, message: msg })
    }

    res.json({ status: 'ok', chispa: result.record })
  } catch (err) {
    next(err)
  }
})

// ── Canjear una Supernova con Estrellas ──
// Body param en la URL: :id de la supernova. Descuenta Estrellas del saldo.
router.post('/me/supernovas/:id/canjear', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

    const result = await referralService.canjearSupernova(Number(req.params.id), email)
    if (!result.ok) {
      const msg = {
        NOT_FOUND:    'Esa Supernova no existe',
        INSUFFICIENT: 'No tienes suficientes Estrellas todavía',
      }[result.reason] ?? 'No se pudo canjear'
      return res.status(409).json({ status: 'error', reason: result.reason, message: msg, restante: result.restante })
    }
    res.json({ status: 'ok', restante: result.restante, supernova: result.supernova })
  } catch (err) {
    next(err)
  }
})

export default router
