/**
 * Destello API — Tallers Routes
 * GET  /tallers        → listar talleres disponibles
 * GET  /tallers/:id    → detalle de un taller
 * POST /tallers/:id/join → inscribirse
 */
import { Router } from 'express'
import * as ctrl  from '../controllers/tallersController.js'

const router = Router()

router.get('/',         ctrl.listTallers)
router.get('/:id',      ctrl.getTaller)
router.post('/:id/join', ctrl.joinTaller)

export default router