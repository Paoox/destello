/**
 * Destello API — Tallers Controller
 * Reemplaza el mock por queries reales a PostgreSQL.
 */

import { listTalleresActivos, getTallerById } from '../services/tallerService.js'
import { AppError } from '../middleware/errorHandler.js'

/**
 * GET /tallers
 * Devuelve solo los talleres con estado 'activo'.
 * Lo consume el bot y la landing page.
 */
export async function listTallers(_req, res, next) {
  try {
    const tallers = await listTalleresActivos()
    res.json({ status: 'ok', tallers })
  } catch (err) {
    next(err)
  }
}

/**
 * GET /tallers/:id
 * Detalle de un taller por ID.
 */
export async function getTaller(req, res, next) {
  try {
    const taller = await getTallerById(req.params.id)
    if (!taller) return next(new AppError('Taller no encontrado', 404, 'NOT_FOUND'))
    res.json({ status: 'ok', taller })
  } catch (err) {
    next(err)
  }
}

export async function joinTaller(req, res) {
  res.json({ status: 'ok', message: 'Usa tu chispa para acceder al taller' })
}