/**
 * Destello API — Puerta de bloqueo para los endpoints del bot
 *
 * POR QUÉ EXISTE
 *
 * Bloquear una cuenta solo en la web dejaría abierta la puerta grande: casi
 * todo el flujo de Destello (apartar lugar, reportar un pago, mandar el
 * comprobante) pasa por Faro, no por el navegador. Si el bot no revisa el
 * bloqueo, bloquear no sirve de nada.
 *
 * Decisión de Paola (24 ago 2026): el bot rechaza igual a quien tiene el
 * acceso bloqueado.
 *
 * QUÉ NO HACE: no calla al bot. Devuelve 403 con `bloqueado: true` y el
 * mensaje ya redactado, para que Faro conteste algo entendible en vez de
 * quedarse mudo o inventar un error técnico.
 */
import { estadoDe, MENSAJE_ACCESO, MENSAJE_COMPRAS } from '../services/bloqueoService.js'

/** Saca el correo de donde venga: body, params o query. */
function emailDeLaPeticion(req) {
    return req.body?.email ?? req.params?.email ?? req.query?.email ?? null
}

/**
 * Cierra el endpoint a quien tiene el ACCESO bloqueado.
 * Para acciones del bot que no deberían existir para una cuenta suspendida:
 * registrarse, reportar un pago, ligar su WhatsApp.
 */
export async function rechazarBloqueados(req, res, next) {
    try {
        const email = emailDeLaPeticion(req)
        if (!email) return next()

        const bloqueo = await estadoDe(email)
        if (bloqueo.acceso) {
            return res.status(403).json({
                status:    'error',
                code:      'CUENTA_BLOQUEADA',
                bloqueado: true,
                message:   MENSAJE_ACCESO,
            })
        }
        next()
    } catch (err) {
        // Si la revisión falla, se deja pasar: una base caída no debe dejar al
        // bot sin poder atender a nadie. Mismo criterio que en authenticate.js.
        console.error('[bot] no se pudo revisar el bloqueo:', err.message)
        next()
    }
}

/**
 * Cierra el endpoint a quien tiene bloqueadas las COMPRAS (o el acceso).
 * Para apartar lugar. `registrarEnLista` ya lo revisa por dentro; esto es para
 * responder con el código y el mensaje correctos antes de llegar allá.
 */
export async function rechazarSinCompras(req, res, next) {
    try {
        const email = emailDeLaPeticion(req)
        if (!email) return next()

        const bloqueo = await estadoDe(email)
        if (bloqueo.acceso || bloqueo.compras) {
            return res.status(403).json({
                status:    'error',
                code:      bloqueo.acceso ? 'CUENTA_BLOQUEADA' : 'COMPRAS_BLOQUEADAS',
                bloqueado: true,
                message:   bloqueo.acceso ? MENSAJE_ACCESO : MENSAJE_COMPRAS,
            })
        }
        next()
    } catch (err) {
        console.error('[bot] no se pudo revisar el bloqueo:', err.message)
        next()
    }
}
