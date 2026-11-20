/**
 * Destello API — Tallers Routes
 * GET  /tallers        → listar talleres disponibles
 * GET  /tallers/:id    → detalle de un taller
 * POST /tallers/:id/join → inscribirse
 */
import { Router } from 'express'
import * as ctrl  from '../controllers/tallersController.js'
import { fichasPublicas } from '../services/profesorService.js'

const router = Router()

router.get('/',         ctrl.listTallers)
// "Conoce a tus profes" (Novedades). Va ANTES de '/:id' o lo atraparía.
router.get('/profes', async (req, res, next) => {
    try { res.json({ status: 'ok', profes: await fichasPublicas() }) }
    catch (err) { next(err) }
})
router.get('/:id',      ctrl.getTaller)
router.post('/:id/join', ctrl.joinTaller)

export default router