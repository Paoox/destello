/**
 * Destello API — Auth Routes
 * POST /auth/login                → login con chispa o email+password
 * POST /auth/social               → login con Google (Firebase idToken)
 * POST /auth/refresh              → renueva JWT
 * POST /auth/logout               → cierra sesión
 *
 * El registro con Resplandor (POST /auth/register, /auth/resplandor/*)
 * se retiró el 18 sep 2026 (T-14c) — era inalcanzable: /acceso no tenía
 * ningún enlace en la app, y nada crea Resplandores nuevos desde T-14a/b.
 * Ver docs/backlog-tickets.md.
 */
import { Router }    from 'express'
import * as ctrl      from '../controllers/authController.js'
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
router.post('/social',              ctrl.loginWithSocial)
router.post('/phone/send-code',     limitarEnvioOtp, phoneCtrl.sendCode)
router.post('/phone/verify',        phoneCtrl.verifyCode)
router.post('/refresh',             ctrl.refreshToken)
router.post('/logout',              ctrl.logout)

export default router