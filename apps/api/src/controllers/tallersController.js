/**
 * Destello API — Tallers Controller
 */
import * as tallerService from '../services/tallerService.js'
import { AppError } from '../middleware/errorHandler.js'

export async function listTallers(_req, res, next) {
  try {
    const talleres = await tallerService.listTalleresActivos()
    res.json({ status: 'ok', tallers: talleres })
  } catch (err) { next(err) }
}

export async function getTaller(req, res, next) {
  try {
    const taller = await tallerService.getTallerById(req.params.id)
    if (!taller) return next(new AppError('Taller no encontrado', 404, 'NOT_FOUND'))
    res.json({ status: 'ok', taller })
  } catch (err) { next(err) }
}

export async function joinTaller(req, res, next) {
  try {
    const taller = await tallerService.getTallerById(req.params.id)
    if (!taller) return next(new AppError('Taller no encontrado', 404, 'NOT_FOUND'))
    res.json({ status: 'ok', message: `Inscrito en ${taller.nombre}` })
  } catch (err) { next(err) }
}