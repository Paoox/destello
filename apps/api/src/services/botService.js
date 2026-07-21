/**
 * Destello API — Bot Service
 * Envía mensajes de WhatsApp a través del bot Faro (Baileys) por su HTTP local.
 * Reutilizado por el envío del admin y por los códigos OTP de acceso.
 */
import { AppError } from '../middleware/errorHandler.js'

const BOT_URL = process.env.BOT_HTTP_URL || 'http://127.0.0.1:4001'

/** Normaliza a 10 dígitos locales MX (quita lada, espacios, símbolos). */
export function normalizarWhatsapp(numero) {
    return String(numero || '').replace(/\D/g, '').slice(-10)
}

/**
 * Envía un WhatsApp desde el número del bot.
 * @param {string} numero  10 dígitos locales MX (ej: 5577888800)
 * @param {string} mensaje texto (soporta *bold* de WhatsApp)
 */
export async function sendWhatsapp(numero, mensaje) {
    const limpio = normalizarWhatsapp(numero)
    if (limpio.length !== 10) {
        throw new AppError('El número debe tener 10 dígitos', 400, 'BAD_REQUEST')
    }

    // Formato JID MX moderno: 521XXXXXXXXXX@s.whatsapp.net
    const jid = `521${limpio}@s.whatsapp.net`

    const botRes = await fetch(`${BOT_URL}/send`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ jid, mensaje }),
    })

    if (!botRes.ok) {
        const errData = await botRes.json().catch(() => ({}))
        throw new AppError(
            errData.error || 'No se pudo enviar el mensaje por WhatsApp',
            502,
            'BOT_ERROR',
        )
    }

    return { ok: true, numero: limpio }
}
