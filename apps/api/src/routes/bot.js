/**
 * Destello API — Bot Routes
 * Todos los endpoints que consume Faro.
 */

import { Router } from 'express'
import {
    registrarUsuario,
    buscarUsuario,
    buscarUsuarioPorWhatsapp,
    agregarALista,
    listasDeUsuario,
    diagnosticoDeAcceso,
    completarWhatsappDeUsuario,
    reportarAcceso,
    reportarPago,
    guardarConversacionBot,
    obtenerConversacionBot,
    registrarEventoBot,
} from '../controllers/botController.js'
import { rechazarBloqueados, rechazarSinCompras } from '../middleware/bloqueoBot.js'
import { verificarBotKey } from '../middleware/verificarBotKey.js'
import { query } from '../db/db.js'
import { registrarReferido, MOTIVO_REFERIDO } from '../services/referralService.js'
import { reportarProblema, CATEGORIAS_SOPORTE } from '../services/ajustesService.js'
import { crearReporte, folioReporte, MOTIVOS } from '../services/reporteService.js'

const router = Router()

// ── Quién puede llamar aquí ──────────────────────────────────
// Solo el bot Faro, identificado por un secreto compartido (BOT_API_KEY).
// Antes de esto, cualquiera en internet podía llamar estos endpoints directo
// (ver T-S1 en docs/backlog-tickets.md).
router.use(verificarBotKey)

// ── Bloqueos ──────────────────────────────────────────────────
// Casi todo el flujo de Destello pasa por Faro, no por el navegador. Un
// bloqueo que solo cerrara la web sería de adorno: la persona seguiría
// apartando lugar y mandando comprobantes por WhatsApp.
//
// Las consultas (GET) NO se cierran: siguen respondiendo, y ahora traen
// `bloqueado` para que el bot sepa con quién habla y conteste bien. Lo que se
// cierra son las ACCIONES.
router.post('/registrar',            rechazarBloqueados, registrarUsuario)
router.get('/usuario/:email',        buscarUsuario)
router.get('/usuario-por-whatsapp/:numero', buscarUsuarioPorWhatsapp)
router.post('/lista-espera',         rechazarSinCompras, agregarALista)
router.get('/listas/:email',         listasDeUsuario)
router.get('/diagnostico/:email',    diagnosticoDeAcceso)
router.post('/completar-whatsapp',   rechazarBloqueados, completarWhatsappDeUsuario)
router.post('/reporte-pago',         rechazarBloqueados, reportarPago)

// ⚠️ `/reporte-acceso` queda ABIERTO a propósito, incluso para cuentas
// bloqueadas. Es el único camino que tiene una persona suspendida para decir
// "creo que esto es un error" y que quede por escrito en la bandeja de Paola.
// Cerrarlo sería bloquear también el derecho a reclamar — y si el bloqueo
// estuvo mal puesto, esa es justo la persona a la que hay que escuchar.
//
// No abre nada: un reporte no activa cuentas, no libera talleres y no toca
// dinero. Solo deja un renglón que alguien tiene que leer.
router.post('/reporte-acceso',       reportarAcceso)

// ── Conversaciones y bitácora ─────────────────────────────────
// Hacen que la conversación sobreviva a un reinicio del bot y que el embudo
// (cuántos empiezan vs cuántos se inscriben) deje de ser invisible.
// ── Referidos (19 nov 2026, migración 028) ──
// ¿A esta persona todavía se le puede preguntar quién la invitó?
router.get('/referido/:email', async (req, res, next) => {
    try {
        const email = String(req.params.email).toLowerCase().trim()
        const { rows } = await query(
            `SELECT u.referido_por,
                    EXISTS (SELECT 1 FROM referidos r WHERE LOWER(r.referido_email) = $1) AS ya
               FROM usuarios u WHERE LOWER(u.email) = $1`, [email])
        res.json({ status: 'ok', puedeUsar: !!rows[0] && !rows[0].referido_por && !rows[0].ya })
    } catch (err) { next(err) }
})
// Liga a la persona con quien la invitó (las Supernovas llegan cuando pague).
router.post('/referido', async (req, res, next) => {
    try {
        const { email, codigo } = req.body ?? {}
        const r = await registrarReferido(codigo, email)
        if (!r.ok) return res.json({ status: 'ok', ok: false, reason: r.reason, message: MOTIVO_REFERIDO[r.reason] })
        const { rows } = await query('SELECT nombre FROM usuarios WHERE LOWER(email) = LOWER($1)', [r.referidorEmail])
        res.json({ status: 'ok', ok: true, invito: rows[0]?.nombre ?? null })
    } catch (err) { next(err) }
})

// ── Soporte por WhatsApp (19 nov 2026) ──
// El botón "Escríbenos por WhatsApp" de Ajustes manda "Necesito ayuda…"; el
// bot pregunta qué pasó y levanta el reporte aquí. Mismo reporte (con folio)
// que el formulario de Ajustes, así Paola lo ve y lo contesta en el panel.
router.get('/soporte/categorias', (_req, res) => res.json({ status: 'ok', categorias: CATEGORIAS_SOPORTE }))
router.post('/soporte', async (req, res, next) => {
    try {
        const { email, whatsapp, categoria, detalle } = req.body ?? {}
        const { rows } = await query(
            `SELECT id FROM usuarios
              WHERE ($1::text IS NOT NULL AND LOWER(email) = LOWER($1::text))
                 OR ($2::text IS NOT NULL AND whatsapp = $2::text)
              ORDER BY (LOWER(email) = LOWER(COALESCE($1::text, ''))) DESC LIMIT 1`,
            [email || null, whatsapp || null])
        if (rows[0]) {
            const r = await reportarProblema(rows[0].id, { categoria, detalle })
            return res.json({ status: 'ok', folio: r.folio })
        }
        // Sin cuenta: se levanta igual, con lo que sepamos.
        const etiqueta = CATEGORIAS_SOPORTE[categoria] ?? 'Otro'
        const { reporte } = await crearReporte({
            email: email || `sin-correo-${whatsapp ?? 'wa'}@destello.local`, nombre: null, whatsapp: whatsapp || null,
            motivo: MOTIVOS.PROBLEMA, detalle: `[${etiqueta}] ${String(detalle ?? '').trim()}`, permitirDuplicado: true,
        })
        res.json({ status: 'ok', folio: folioReporte(reporte.id) })
    } catch (err) { next(err) }
})

router.put('/conversacion/:jid',     guardarConversacionBot)
router.get('/conversacion/:jid',     obtenerConversacionBot)
router.post('/evento',               registrarEventoBot)

export default router