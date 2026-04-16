/**
 * Destello API — Users Routes
 * GET  /users/me        → perfil del usuario autenticado
 * PUT  /users/me        → actualizar perfil
 * GET  /users/me/progress → progreso en talleres
 */
import { Router } from 'express'

const router = Router()

router.get('/me', (req, res) => {
  res.json({ status: 'ok', user: req.user })
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

export default router
