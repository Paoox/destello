/**
 * Destello API — Bot Controller
 * Endpoints públicos que consume Faro (bot de WhatsApp).
 */

import { upsertUsuario, findByEmail } from '../services/usuarioService.js'
import { registrarEnLista, getListasPorEmail, getPendientesPorEmail } from '../services/listaEsperaService.js'
import { AppError } from '../middleware/errorHandler.js'

/**
 * POST /bot/registrar
 * Crea o actualiza un usuario desde el bot.
 */
export async function registrarUsuario(req, res, next) {
    try {
        const { email, nombre, whatsapp } = req.body
        if (!email) throw new AppError('email es requerido', 400, 'BAD_REQUEST')

        const usuario = await upsertUsuario({ email, nombre, whatsapp })
        res.status(201).json({ status: 'ok', usuario })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /bot/usuario/:email
 * Verifica si un usuario existe y cuál es su estado.
 */
export async function buscarUsuario(req, res, next) {
    try {
        const usuario = await findByEmail(req.params.email)
        if (!usuario) return res.json({ status: 'ok', existe: false })
        res.json({ status: 'ok', existe: true, usuario })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /bot/lista-espera
 * Registra a un usuario en la lista de espera de un taller.
 */
export async function agregarALista(req, res, next) {
    try {
        const { email, tallerId, nombre, whatsapp } = req.body
        if (!email)    throw new AppError('email es requerido', 400, 'BAD_REQUEST')
        if (!tallerId) throw new AppError('tallerId es requerido', 400, 'BAD_REQUEST')

        const resultado = await registrarEnLista({ email, tallerId, nombre, whatsapp })
        res.status(201).json({ status: 'ok', ...resultado })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /bot/listas/:email
 * Devuelve todas las listas de espera activas de un usuario.
 */
export async function listasDeUsuario(req, res, next) {
    try {
        const listas = await getListasPorEmail(req.params.email)
        res.json({ status: 'ok', listas })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /bot/pendientes/:email
 * Verifica si hay chispas o resplandores pendientes para un email.
 */
export async function pendientesDeUsuario(req, res, next) {
    try {
        const pendientes = await getPendientesPorEmail(req.params.email)
        res.json({ status: 'ok', ...pendientes })
    } catch (err) {
        next(err)
    }
}