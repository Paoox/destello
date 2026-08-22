/**
 * Destello Bot — Entry Point
 * Conecta a WhatsApp con Baileys.
 * La primera vez muestra un QR para escanear con el celular.
 * La sesión se guarda en ./auth_info/ para no pedir QR cada vez.
 *
 * También expone un servidor HTTP interno (puerto BOT_HTTP_PORT, default 4001)
 * para que el panel admin pueda enviar mensajes desde este número:
 *   POST /send  { jid, mensaje }
 *   GET  /health
 */

import 'dotenv/config'
import http from 'node:http'
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} from 'baileys'
import { downloadMediaMessage } from 'baileys'
import qrcode              from 'qrcode-terminal'
import pino                from 'pino'
import {
    procesarMensaje,
    esperaComprobante,
    registrarComprobante,
    imagenInesperada,
} from './src/flujo.js'

const logger = pino({ level: 'silent' })

/**
 * Número de la admin (10 dígitos MX) al que se reenvían los comprobantes.
 * Es el mismo ADMIN_WA que ya usa la API para los avisos de reportes.
 */
const ADMIN_WA  = process.env.ADMIN_WA || null
const ADMIN_JID = ADMIN_WA
    ? `521${String(ADMIN_WA).replace(/\D/g, '').slice(-10)}@s.whatsapp.net`
    : null

// ── Anti-duplicados ───────────────────────────────────────────
//
// Baileys puede entregar el MISMO mensaje en dos eventos `messages.upsert`
// (reconexiones, sincronización con el celular). Sin esto el bot contesta dos
// veces al mismo mensaje — y en el flujo de pago llegaría a registrar el
// comprobante dos veces y reenviártelo duplicado.
const mensajesVistos = new Map()   // id del mensaje → cuándo se atendió
const VENTANA_MS     = 10 * 60 * 1000
const TOPE           = 1000

function yaAtendido(id) {
    if (!id) return false

    const ahora = Date.now()

    if (mensajesVistos.size >= TOPE) {
        // Primero se tiran los que ya salieron de la ventana...
        for (const [visto, cuando] of mensajesVistos) {
            if (ahora - cuando > VENTANA_MS) mensajesVistos.delete(visto)
        }
        // ...y si aun así sigue lleno (mucho tráfico en pocos minutos), se tira
        // la mitad más antigua. Map conserva el orden de inserción, así que los
        // primeros son los más viejos. Sin este tope la memoria crecería sin fin
        // en un día de mucho movimiento.
        if (mensajesVistos.size >= TOPE) {
            let porTirar = Math.floor(mensajesVistos.size / 2)
            for (const visto of mensajesVistos.keys()) {
                if (porTirar-- <= 0) break
                mensajesVistos.delete(visto)
            }
        }
    }

    if (mensajesVistos.has(id)) return true
    mensajesVistos.set(id, ahora)
    return false
}

// ── Socket global — disponible para el servidor HTTP ─────────
let sockGlobal = null

// ── Servidor HTTP interno (para envíos desde el panel admin) ─
const BOT_HTTP_PORT = Number(process.env.BOT_HTTP_PORT) || 4001

const httpServer = http.createServer(async (req, res) => {
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        return res.end(JSON.stringify({ ok: true, connected: !!sockGlobal }))
    }

    // Enviar mensaje
    if (req.method === 'POST' && req.url === '/send') {
        let body = ''
        req.on('data', chunk => { body += chunk })
        req.on('end', async () => {
            try {
                const { jid, mensaje } = JSON.parse(body)

                if (!sockGlobal) {
                    res.writeHead(503, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ error: 'Bot no conectado a WhatsApp' }))
                }

                if (!jid || !mensaje) {
                    res.writeHead(400, { 'Content-Type': 'application/json' })
                    return res.end(JSON.stringify({ error: 'jid y mensaje son requeridos' }))
                }

                await sockGlobal.sendMessage(jid, { text: mensaje })
                console.log(`📤 Mensaje enviado desde panel → ${jid}`)

                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
            } catch (err) {
                console.error('[bot-http] Error al enviar:', err.message)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ error: err.message }))
            }
        })
        return
    }

    res.writeHead(404)
    res.end('Not found')
})

httpServer.listen(BOT_HTTP_PORT, '0.0.0.0', () => {
    console.log(`✦ Bot HTTP API escuchando en puerto ${BOT_HTTP_PORT}`)
})

// ── Conexión a WhatsApp ───────────────────────────────────────
async function conectar() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth_info')
    const { version }          = await fetchLatestBaileysVersion()

    console.log(`✦ Destello Bot iniciando con WA v${version.join('.')}`)

    const sock = makeWASocket({
        version,
        logger,
        auth:              state,
        printQRInTerminal: false,
    })

    // ── QR y estado de conexión ───────────────────────────────
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log('\n══════════════════════════════════')
            console.log('  Escanea con WhatsApp Business:  ')
            console.log('══════════════════════════════════\n')
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            sockGlobal = null   // marcar como desconectado mientras reconecta

            const statusCode     = lastDisconnect?.error?.output?.statusCode
            const fueLogout      = statusCode === DisconnectReason.loggedOut
            const fueReemplazado = statusCode === DisconnectReason.connectionReplaced // 440

            console.log(`⚠  Conexión cerrada (código ${statusCode}).`)

            if (fueLogout) {
                console.log('⚠  Sesión cerrada. Borra ./auth_info/ y vuelve a escanear el QR.')
                process.exit(0)
            } else if (fueReemplazado) {
                console.log('⚠  Sesión reemplazada por otra instancia. Saliendo.')
                process.exit(0)
            } else {
                // 515 = restart required (normal después del QR y reconexiones)
                // 408/428 = pérdida de red — reconectar en ambos casos
                console.log('↺  Reconectando en 5s...')
                setTimeout(conectar, 5000)
            }
        }

        if (connection === 'open') {
            sockGlobal = sock   // exponer el socket al servidor HTTP
            console.log('\n✅ ¡Bot conectado a WhatsApp! Esperando mensajes...\n')
        }
    })

    sock.ev.on('creds.update', saveCreds)

    // ── Mensajes entrantes ────────────────────────────────────
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return

        for (const msg of messages) {
            if (msg.key.fromMe)                        continue  // ignorar mis propios mensajes
            if (msg.key.remoteJid?.endsWith('@g.us'))  continue  // ignorar grupos
            if (yaAtendido(msg.key.id))                continue  // no contestar dos veces lo mismo

            const jid   = msg.key.remoteJid?.replace(/:\d+@/, '@')
            const texto = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || ''

            // Cuando el chat es @lid (ID interno de WA), Baileys puede adjuntar
            // el número real en senderPn / participantPn. Lo pasamos al flujo
            // para no tener que pedirle el número al usuario.
            const senderPn = (msg.key.senderPn || msg.key.participantPn || null)
                ?.replace(/:\d+@/, '@') || null

            // ── Imágenes (comprobantes de pago) ───────────────
            //
            // Antes esto se descartaba junto con todo lo que no fuera texto, así
            // que un comprobante llegaba y se perdía en silencio: la persona creía
            // haberlo mandado y nadie se enteraba. Ahora se atiende primero.
            // Cuenta como comprobante tanto una foto normal como un documento
            // que sea imagen: mucha gente manda la captura "como archivo".
            const doc       = msg.message?.documentMessage
            const docEsFoto = doc?.mimetype?.startsWith('image/') ? doc : null
            const imagen    = msg.message?.imageMessage || docEsFoto || null

            if (imagen) {
                console.log(`🖼  ${jid}: imagen recibida`)
                try {
                    await sock.sendPresenceUpdate('composing', jid)

                    if (!esperaComprobante(jid)) {
                        await sock.sendMessage(jid, { text: imagenInesperada(jid) })
                        await sock.sendPresenceUpdate('paused', jid)
                        continue
                    }

                    const caption = imagen.caption?.trim() || null

                    // Se descarga UNA vez y sirve para las dos cosas: guardarla en
                    // el panel y reenviártela por WhatsApp.
                    const buffer = await downloadMediaMessage(msg, 'buffer', {})

                    const { texto: respuesta, avisoAdmin } = await registrarComprobante(
                        jid, caption, buffer, imagen.mimetype,
                    )

                    // Se reenvía a la admin ANTES de confirmarle al alumno: si el
                    // reenvío falla, preferimos enterarnos en los logs y no haberle
                    // prometido a la persona que ya llegó.
                    if (ADMIN_JID) {
                        await sock.sendMessage(ADMIN_JID, { image: buffer, caption: avisoAdmin })
                        console.log(`📤 Comprobante reenviado a la admin`)
                    } else {
                        console.warn('[bot] ADMIN_WA no configurado — el comprobante NO se reenvió')
                    }

                    await sock.sendMessage(jid, { text: respuesta })
                    await sock.sendPresenceUpdate('paused', jid)
                } catch (err) {
                    console.error('[bot] Error con el comprobante:', err.message)
                    await sock.sendMessage(jid, {
                        text: '😅 Algo falló al recibir tu comprobante. ¿Puedes mandarlo otra vez?',
                    }).catch(() => {})
                }
                continue
            }

            if (!texto) continue

            console.log(`📨 ${jid}${senderPn ? ` (pn: ${senderPn})` : ''}: "${texto}"`)

            try {
                await sock.sendPresenceUpdate('composing', jid)
                const respuesta = await procesarMensaje(jid, texto, senderPn)
                await new Promise(r => setTimeout(r, 800))
                await sock.sendMessage(jid, { text: respuesta })
                await sock.sendPresenceUpdate('paused', jid)
                console.log(`✉  Respuesta enviada`)
            } catch (err) {
                console.error(`[bot] Error:`, err.message)
            }
        }
    })
}

conectar().catch(console.error)