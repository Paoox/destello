/**
 * Destello Bot — Entry Point
 * Conecta a WhatsApp con Baileys.
 * La primera vez muestra un QR para escanear con el celular.
 * La sesión se guarda en ./auth_info/ para no pedir QR cada vez.
 */

import 'dotenv/config'
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
} from 'baileys'
import qrcode              from 'qrcode-terminal'
import pino                from 'pino'
import { procesarMensaje } from './src/flujo.js'

const logger = pino({ level: 'silent' })

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
            const statusCode     = lastDisconnect?.error?.output?.statusCode
            const fueLogout      = statusCode === DisconnectReason.loggedOut
            const fueReemplazado = statusCode === DisconnectReason.connectionReplaced // 440

            console.log(`⚠  Conexión cerrada (código ${statusCode}).`)

            if (fueLogout) {
                console.log('⚠  Sesión cerrada. Borra la carpeta ./auth_info/ y reinicia.')
            } else if (fueReemplazado) {
                console.log('⚠  Sesión reemplazada por otra instancia. Deteniendo para evitar loop.')
                process.exit(1)
            } else {
                console.log('↺  Reconectando en 5s...')
                setTimeout(conectar, 5000)
            }
        }

        if (connection === 'open') {
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

            const jid   = msg.key.remoteJid
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