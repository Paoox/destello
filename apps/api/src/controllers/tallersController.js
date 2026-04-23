/**
 * Destello API — Tallers Controller
 */
import * as tallerService      from '../services/tallerService.js'
import * as listaEsperaService from '../services/listaEsperaService.js'
import { AppError }            from '../middleware/errorHandler.js'

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

/**
 * POST /tallers/:id/join
 * Registra el interés de un usuario en un taller → lista de espera.
 * Body: { email, nombre?, whatsapp? }
 */
export async function joinTaller(req, res, next) {
  try {
    const taller = await tallerService.getTallerById(req.params.id)
    if (!taller) return next(new AppError('Taller no encontrado', 404, 'NOT_FOUND'))

    const { email, nombre, whatsapp } = req.body
    if (!email) throw new AppError('email es requerido', 400, 'BAD_REQUEST')

    const resultado = await listaEsperaService.registrarEnLista({
      email,
      tallerId: req.params.id,
      nombre,
      whatsapp,
    })

    res.status(resultado.nuevo ? 201 : 200).json({
      status:  'ok',
      nuevo:   resultado.nuevo,
      message: resultado.nuevo
          ? `Te registramos en la lista de espera de "${taller.nombre}". ¡Te avisamos pronto!`
          : `Ya estás en la lista de espera de "${taller.nombre}".`,
    })
  } catch (err) { next(err) }
}