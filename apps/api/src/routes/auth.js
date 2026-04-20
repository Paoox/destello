/**
 * Destello API — Auth Routes
 * POST /auth/login     → login con código de pago
 * GET  /auth/google    → OAuth Google (redirect)
 * GET  /auth/callback  → callback OAuth
 */
import { Router }    from 'express'
import * as ctrl     from '../controllers/authController.js'

const router = Router()

router.post('/login',    ctrl.loginWithCode)
router.get('/google',    ctrl.oauthRedirect('google'))
router.get('/facebook',  ctrl.oauthRedirect('facebook'))
router.get('/instagram', ctrl.oauthRedirect('instagram'))
router.get('/callback',  ctrl.oauthCallback)
router.post('/refresh',  ctrl.refreshToken)
router.post('/logout',   ctrl.logout)

export default router