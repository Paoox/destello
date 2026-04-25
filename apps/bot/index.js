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
import qrcode              from 'qrcode-terminal'
import pino                from 'pino'
import { procesarMensaje } from './src/flujo.js'

const logger = pino({ level: 'silent' })

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

httpServer.listen(BOT_HTTP_PORT, '127.0.0.1', () => {
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

            const jid   = msg.key.remoteJid?.replace(/:\d+@/, '@')
            const texto = msg.message?.conversation
                || msg.message?.extendedTextMessage?.text
                || ''

            if (!texto) continue

            console.log(`📨 ${jid}: "${texto}"`)

            try {
                await sock.sendPresenceUpdate('composing', jid)
                const respuesta = await procesarMensaje(jid, texto)
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