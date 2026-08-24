/**
 * Destello API — Tallers Controller (rutas públicas)
 */
import * as tallerService      from '../services/tallerService.js'
import * as listaEsperaService from '../services/listaEsperaService.js'
import { AppError }            from '../middleware/errorHandler.js'
import { MENSAJE_COMPRAS }     from '../services/bloqueoService.js'

/** GET /tallers — landing page: activo + próximamente + lleno */
export async function listTallers(_req, res, next) {
  try {
    const talleres = await tallerService.listTalleresPublicos()
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
      // Este es el modal del Habitat en la web, no el bot de WhatsApp.
      origen: 'web',
    })

    // Compras bloqueadas: no se le dice "no hay lugar" ni se finge que sí
    // quedó registrada. Se le da el motivo real y por dónde reclamar.
    if (resultado.bloqueado) {
      return res.status(403).json({
        status:    'error',
        code:      'COMPRAS_BLOQUEADAS',
        bloqueado: true,
        message:   MENSAJE_COMPRAS,
      })
    }

    // Taller lleno: 409 y un mensaje que la persona pueda entender. No es un
    // error del sistema, es una respuesta legítima — por eso lleva su propio
    // código para que el front lo distinga de una falla.
    if (resultado.sinCupo) {
      return res.status(409).json({
        status:  'error',
        code:    'SIN_CUPO',
        agotado: true,
        cupo:    resultado.cupo,
        message: `"${taller.nombre}" ya no tiene lugares disponibles. ` +
                 'Escríbenos por WhatsApp y te avisamos en cuanto abramos otra fecha.',
      })
    }

    res.status(resultado.nuevo ? 201 : 200).json({
      status:  'ok',
      nuevo:   resultado.nuevo,
      message: resultado.nuevo
          ? `Te registramos en la lista de espera de "${taller.nombre}". ¡Te avisamos pronto!`
          : `Ya estás en la lista de espera de "${taller.nombre}".`,
    })
  } catch (err) { next(err) }
}