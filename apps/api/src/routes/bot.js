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

export default router