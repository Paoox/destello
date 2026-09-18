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
import * as ctrl      from '../controllers/authController.js'
import * as respCtrl  from '../controllers/resplandorController.js'
import * as phoneCtrl from '../controllers/phoneAuthController.js'
import { rateLimit }  from '../middleware/rateLimit.js'

const router = Router()

// otpService.js ya limita por NÚMERO (30s entre reenvíos); esto limita por
// IP, para que no se pueda usar el envío de OTP como vector de spam de
// WhatsApp hacia números ajenos (T-S2, docs/backlog-tickets.md).
const limitarEnvioOtp = rateLimit({
    windowMs: 10 * 60 * 1000,
    max:      8,
    mensaje:  'Demasiados códigos solicitados. Espera unos minutos.',
})

router.post('/login',               ctrl.loginWithCode)
router.post('/register',            ctrl.registerUser)
router.post('/social',              ctrl.loginWithSocial)
router.post('/phone/send-code',     limitarEnvioOtp, phoneCtrl.sendCode)
router.post('/phone/verify',        phoneCtrl.verifyCode)
router.post('/resplandor/validate', respCtrl.validateResplandorCode)
router.post('/resplandor/consume',  respCtrl.consumeResplandorCode)
router.post('/refresh',             ctrl.refreshToken)
router.post('/logout',              ctrl.logout)

export default router