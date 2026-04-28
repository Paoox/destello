/**
 * Destello API — Auth Routes
 * POST /auth/login                → login con chispa o email+password
 * POST /auth/register             → crear cuenta con resplandor válido
 * POST /auth/social               → login con Google (Firebase idToken)
 * POST /auth/resplandor/validate  → valida resplandor sin consumirlo
 * POST /auth/resplandor/consume   → consume resplandor al completar el registro
 * POST /auth/refresh              → renueva JWT
 * POST /auth/logout               → cierra sesión
 */
import { Router }    from 'express'
import * as ctrl     from '../controllers/authController.js'
import * as respCtrl from '../controllers/resplandorController.js'

const router = Router()

router.post('/login',               ctrl.loginWithCode)
router.post('/register',            ctrl.registerUser)
router.post('/social',              ctrl.loginWithSocial)
router.post('/resplandor/validate', respCtrl.validateResplandorCode)
router.post('/resplandor/consume',  respCtrl.consumeResplandorCode)
router.post('/refresh',             ctrl.refreshToken)
router.post('/logout',              ctrl.logout)

export default router