/**
 * Destello API — Bot Routes
 * Todos los endpoints que consume Faro.
 */

import { Router } from 'express'
import {
    registrarUsuario,
    buscarUsuario,
    agregarALista,
    listasDeUsuario,
    pendientesDeUsuario,
    diagnosticoDeAcceso,
    completarWhatsappDeUsuario,
    reportarAcceso,
    reportarPago,
    guardarConversacionBot,
    obtenerConversacionBot,
    registrarEventoBot,
} from '../controllers/botController.js'
import { rechazarBloqueados, rechazarSinCompras } from '../middleware/bloqueoBot.js'

const router = Router()

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
router.post('/lista-espera',         rechazarSinCompras, agregarALista)
router.get('/listas/:email',         listasDeUsuario)
router.get('/pendientes/:email',     pendientesDeUsuario)
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
router.put('/conversacion/:jid',     guardarConversacionBot)
router.get('/conversacion/:jid',     obtenerConversacionBot)
router.post('/evento',               registrarEventoBot)

export default router