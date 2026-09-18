/**
 * Destello API — Rate limiting simple por IP, en memoria.
 *
 * Mismo criterio que otpService.js: la API corre en un solo contenedor, así
 * que un Map basta — no hace falta Redis ni una librería externa para esto.
 * Cierra T-S2 (docs/backlog-tickets.md): sin esto, `/admin/login` se podía
 * probar por fuerza bruta sin ningún freno, y `/auth/phone/send-code` se
 * podía usar para mandar WhatsApps de spam a números ajenos sin límite por IP
 * (el límite que ya existe en otpService.js es por número, no por quien pide).
 */
import { AppError } from './errorHandler.js'

/**
 * IP real del cliente. La API vive detrás de un Cloudflare Tunnel, así que
 * `req.ip` normalmente sería la del túnel, no la de quien hace la petición —
 * Cloudflare siempre manda la IP real en este header.
 */
export function clientIp(req) {
    return req.headers['cf-connecting-ip'] || req.ip
}

/**
 * Middleware que limita a `max` peticiones por `windowMs` ms, por IP.
 * Pasado el límite, responde 429 con `Retry-After`.
 *
 * @param {{ windowMs: number, max: number, mensaje?: string }} opts
 */
export function rateLimit({ windowMs, max, mensaje = 'Demasiados intentos. Espera un momento e intenta de nuevo.' }) {
    const store = new Map()   // ip -> { count, resetAt }

    // Limpieza periódica de entradas vencidas (evita fuga de memoria).
    const sweep = setInterval(() => {
        const now = Date.now()
        for (const [ip, rec] of store) if (now > rec.resetAt) store.delete(ip)
    }, windowMs)
    sweep.unref?.()

    return function (req, res, next) {
        const ip  = clientIp(req)
        const now = Date.now()
        let rec   = store.get(ip)

        if (!rec || now > rec.resetAt) {
            rec = { count: 0, resetAt: now + windowMs }
            store.set(ip, rec)
        }

        rec.count += 1

        if (rec.count > max) {
            const waitSeconds = Math.ceil((rec.resetAt - now) / 1000)
            res.set('Retry-After', String(waitSeconds))
            return next(new AppError(`${mensaje} (espera ${waitSeconds}s)`, 429, 'TOO_MANY_REQUESTS'))
        }

        next()
    }
}
