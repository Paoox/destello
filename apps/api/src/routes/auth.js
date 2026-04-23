/**
 * Destello API — Auth Routes
 * POST /auth/login                → login con chispa (usuario con cuenta)
 * POST /auth/resplandor/validate  → valida resplandor sin consumirlo (→ pantalla de registro)
 * POST /auth/resplandor/consume   → consume resplandor al completar el registro
 * GET  /auth/google               → OAuth Google (redirect)
 * GET  /auth/callback             → callback OAuth
 */
import { Router }    from 'express'
import * as ctrl     from '../controllers/authController.js'
import * as respCtrl from '../controllers/resplandorController.js'

const router = Router()

router.post('/login',                   ctrl.loginWithCode)
router.post('/resplandor/validate',     respCtrl.validateResplandorCode)
router.post('/resplandor/consume',      respCtrl.consumeResplandorCode)
router.get('/google',                   ctrl.oauthRedirect('google'))
router.get('/facebook',                 ctrl.oauthRedirect('facebook'))
router.get('/instagram',                ctrl.oauthRedirect('instagram'))
router.get('/callback',                 ctrl.oauthCallback)
router.post('/refresh',                 ctrl.refreshToken)
router.post('/logout',                  ctrl.logout)

export default router