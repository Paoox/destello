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

const router = Router()

router.post('/registrar',            registrarUsuario)
router.get('/usuario/:email',        buscarUsuario)
router.post('/lista-espera',         agregarALista)
router.get('/listas/:email',         listasDeUsuario)
router.get('/pendientes/:email',     pendientesDeUsuario)
router.get('/diagnostico/:email',    diagnosticoDeAcceso)
router.post('/completar-whatsapp',   completarWhatsappDeUsuario)
router.post('/reporte-acceso',       reportarAcceso)
router.post('/reporte-pago',         reportarPago)

// ── Conversaciones y bitácora ─────────────────────────────────
// Hacen que la conversación sobreviva a un reinicio del bot y que el embudo
// (cuántos empiezan vs cuántos se inscriben) deje de ser invisible.
router.put('/conversacion/:jid',     guardarConversacionBot)
router.get('/conversacion/:jid',     obtenerConversacionBot)
router.post('/evento',               registrarEventoBot)

export default router