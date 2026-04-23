/**
 * Destello API — Admin Routes
 */
import { Router }     from 'express'
import * as ctrl      from '../controllers/adminController.js'
import * as respCtrl  from '../controllers/resplandorController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'

const router = Router()

router.post('/login', ctrl.adminLogin)

router.use(authenticateAdmin)

// Chispas
router.post('/chispas',          ctrl.generateChispa)
router.post('/chispas/batch',    ctrl.generateBatch)
router.get('/chispas',           ctrl.listChispas)
router.get('/chispas/stats',     ctrl.getStats)
router.delete('/chispas/:code',  ctrl.revokeChispa)

// Talleres
router.get('/talleres',          ctrl.listTalleres)
router.post('/talleres',         ctrl.createTaller)
router.put('/talleres/:id',      ctrl.updateTaller)

// Resplandores
router.post('/resplandores',           respCtrl.generateResplandor)
router.get('/resplandores',            respCtrl.listResplandores)
router.get('/resplandores/stats',      respCtrl.getResplandorStats)
router.delete('/resplandores/:code',   respCtrl.revokeResplandor)

// Lista de espera
router.get('/lista-espera',                   ctrl.listEspera)
router.post('/lista-espera/:id/confirmar',    ctrl.confirmarCupo)

export default router