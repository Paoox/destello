/**
 * Destello API — Chispas Routes
 * ─────────────────────────────────────────────────────────────────────────────
 * Todas las rutas del módulo de chispas.
 *
 * Rutas PÚBLICAS (sin JWT):
 *   POST /chispas/validate          → verifica si un código es válido
 *
 * Rutas de ADMIN (requieren JWT — el middleware `authenticate` se aplica
 * en index.js al montar este router bajo /chispas):
 *   POST   /chispas/generate        → genera una chispa
 *   POST   /chispas/generate/batch  → genera N chispas a la vez
 *   GET    /chispas                 → lista todas (con filtros)
 *   GET    /chispas/stats           → estadísticas del store
 *   GET    /chispas/:code           → detalle de una chispa
 *   DELETE /chispas/:code           → revoca una chispa
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Router }    from 'express'
import { authenticate } from '../middleware/authenticate.js'
import * as ctrl     from '../controllers/chispasController.js'

const router = Router()

// ── Rutas públicas ────────────────────────────────────────────────────────────
// validate es público porque se usa antes de tener sesión (flow de login)
router.post('/validate', ctrl.validateChispa)

// ── Rutas protegidas (admin) ──────────────────────────────────────────────────
// Aplicamos authenticate aquí en lugar de en index.js para ser explícitos
// y permitir que en el futuro algunas rutas de este archivo sean semi-públicas.
router.post('/generate',       authenticate, ctrl.generateChispa)
router.post('/generate/batch', authenticate, ctrl.generateBatch)
router.get('/stats',           authenticate, ctrl.getStats)
router.get('/',                authenticate, ctrl.listChispas)
router.get('/:code',           authenticate, ctrl.getChispa)
router.delete('/:code',        authenticate, ctrl.revokeChispa)

export default router