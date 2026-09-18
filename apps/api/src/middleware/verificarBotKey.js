/**
 * Destello API — Verifica que quien llama a /bot/* sea el bot Faro
 *
 * Los endpoints de /bot/* no piden JWT (el bot no tiene cuenta de usuario),
 * pero eso los dejaba abiertos a CUALQUIERA en internet: CORS solo frena
 * navegadores, no un `curl` ni otro servidor. Sin este middleware, alguien
 * podía llamar `/bot/registrar` con el correo de una cuenta ajena y su propio
 * WhatsApp, y de ahí entrar por `/auth/phone/verify` — ver T-S1 en
 * docs/backlog-tickets.md.
 *
 * El secreto es compartido entre la API y el bot (BOT_API_KEY en ambos
 * .env), nunca viaja al frontend ni a un usuario.
 */
import { AppError } from './errorHandler.js'

export function verificarBotKey(req, res, next) {
    const esperado = process.env.BOT_API_KEY

    // Config faltante NUNCA debe abrir la puerta — sería el mismo agujero que
    // este middleware existe para cerrar.
    if (!esperado) {
        console.error('[bot] BOT_API_KEY no está configurado — rechazando /bot/*')
        return next(new AppError('Bot API no configurada', 500, 'BOT_KEY_NOT_CONFIGURED'))
    }

    const recibido = req.headers['x-bot-key']
    if (recibido !== esperado) {
        return next(new AppError('No autorizado', 401, 'UNAUTHORIZED'))
    }

    next()
}
