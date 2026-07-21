/**
 * Destello API — Phone Auth Controller
 * Acceso / verificación por número de WhatsApp con código OTP.
 *
 * POST /auth/phone/send-code  { whatsapp }
 *   → genera un código, lo guarda en memoria y lo envía por el bot Faro.
 *
 * POST /auth/phone/verify     { whatsapp, code }   (Authorization opcional)
 *   → valida el código y:
 *     - Si viene un JWT (onboarding tras Google) → liga el número a ese usuario.
 *     - Si no → login por número: busca al usuario por su whatsapp y emite JWT.
 */
import jwt        from 'jsonwebtoken'
import { AppError } from '../middleware/errorHandler.js'
import { query }    from '../db/db.js'
import * as otp     from '../services/otpService.js'
import { sendWhatsapp, normalizarWhatsapp } from '../services/botService.js'

function signToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    })
}

// POST /auth/phone/send-code
export async function sendCode(req, res, next) {
    try {
        const whatsapp = normalizarWhatsapp(req.body.whatsapp)
        if (whatsapp.length !== 10) {
            throw new AppError('Ingresa tu número a 10 dígitos', 400, 'BAD_REQUEST')
        }

        const rl = otp.canResend(whatsapp)
        if (!rl.ok) {
            throw new AppError(`Espera ${rl.waitSeconds}s para pedir otro código`, 429, 'RESEND_TOO_SOON')
        }

        const code = otp.generate(whatsapp)
        const mensaje =
            `✦ *Destello*\n\n` +
            `Tu código de acceso es: *${code}*\n\n` +
            `Vence en 10 minutos. No lo compartas con nadie. 🌟`

        await sendWhatsapp(whatsapp, mensaje)

        res.json({ status: 'ok', message: 'Código enviado por WhatsApp' })
    } catch (err) { next(err) }
}

// POST /auth/phone/verify
export async function verifyCode(req, res, next) {
    try {
        const whatsapp = normalizarWhatsapp(req.body.whatsapp)
        const { code } = req.body

        if (whatsapp.length !== 10 || !code) {
            throw new AppError('whatsapp y code son requeridos', 400, 'BAD_REQUEST')
        }

        const result = otp.verify(whatsapp, code)
        if (!result.ok) {
            const msgs = {
                NO_CODE:           'No hay un código activo para ese número. Pide uno nuevo.',
                EXPIRED:           'El código expiró. Pide uno nuevo.',
                TOO_MANY_ATTEMPTS: 'Demasiados intentos. Pide un código nuevo.',
                INVALID_CODE:      'Código incorrecto. Revísalo e intenta de nuevo.',
            }
            throw new AppError(msgs[result.reason] ?? 'Código inválido', 401, result.reason)
        }

        // ¿Viene un usuario autenticado? (onboarding tras Google → ligar número)
        let authedUserId = null
        const authHeader = req.headers.authorization
        if (authHeader?.startsWith('Bearer ')) {
            try { authedUserId = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET).userId }
            catch { /* token inválido → se ignora, se trata como login por número */ }
        }

        if (authedUserId) {
            const { rows } = await query(
                `UPDATE usuarios SET whatsapp = $2
                 WHERE id = $1
                 RETURNING id, email, nombre, apellido, whatsapp, estado`,
                [authedUserId, whatsapp]
            )
            const u = rows[0]
            if (!u) throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND')
            const token = signToken({ userId: u.id, role: 'alumno' })
            return res.json({ status: 'ok', token, user: { ...u, role: 'alumno' } })
        }

        // Login por número: buscar cuenta por whatsapp
        const { rows } = await query(
            `SELECT id, email, nombre, apellido, whatsapp, estado
             FROM usuarios
             WHERE whatsapp = $1 AND estado = 'activo'
             ORDER BY id
             LIMIT 1`,
            [whatsapp]
        )

        if (!rows.length) {
            throw new AppError(
                'No encontramos una cuenta activa con ese número. Inscríbete por WhatsApp o entra con Google.',
                404,
                'NO_ACCOUNT',
            )
        }

        const u     = rows[0]
        const token = signToken({ userId: u.id, role: 'alumno' })
        res.json({ status: 'ok', token, user: { ...u, role: 'alumno' } })
    } catch (err) { next(err) }
}
