/**
 * Destello API — Admin Routes
 *
 * POST /admin/login           → pública — emite adminToken
 * POST /admin/chispas         → genera una chispa (admin)
 * POST /admin/chispas/batch   → genera N chispas (admin)
 * GET  /admin/chispas         → lista todas (admin)
 * GET  /admin/chispas/stats   → estadísticas (admin)
 * DELETE /admin/chispas/:code → revoca (admin)
 */
import { Router }            from 'express'
import { adminLogin }        from '../controllers/adminController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import * as chispaCtrl       from '../controllers/chispasController.js'

const router = Router()

// ── Pública ───────────────────────────────────────────────
router.post('/login', adminLogin)

// ── Protegidas con adminToken ─────────────────────────────
router.use(authenticateAdmin)

router.post('/chispas',        chispaCtrl.generateChispa)
router.post('/chispas/batch',  chispaCtrl.generateBatch)
router.get('/chispas',         chispaCtrl.listChispas)
router.get('/chispas/stats',   chispaCtrl.getStats)
router.delete('/chispas/:code', chispaCtrl.revokeChispa)

export default router