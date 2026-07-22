/**
 * Destello API — Bot Controller
 * Endpoints públicos que consume Faro (bot de WhatsApp).
 */

import { upsertUsuario, findByEmail } from '../services/usuarioService.js'
import { registrarEnLista, getListasPorEmail, getPendientesPorEmail } from '../services/listaEsperaService.js'
import { diagnosticar, completarWhatsapp } from '../services/diagnosticoService.js'
import { crearReporte, MOTIVOS } from '../services/reporteService.js'
import { AppError } from '../middleware/errorHandler.js'

/**
 * POST /bot/registrar
 * Crea o actualiza un usuario desde el bot.
 */
export async function registrarUsuario(req, res, next) {
    try {
        const { email, nombre, apellido, whatsapp } = req.body
        if (!email) throw new AppError('email es requerido', 400, 'BAD_REQUEST')

        const usuario = await upsertUsuario({ email, nombre, apellido, whatsapp })
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

/**
 * GET /bot/diagnostico/:email
 * Foto completa del acceso de una persona, para que el bot ramifique sin
 * hacer cuatro llamadas distintas.
 */
export async function diagnosticoDeAcceso(req, res, next) {
    try {
        const diagnostico = await diagnosticar(req.params.email)
        res.json({ status: 'ok', ...diagnostico })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /bot/completar-whatsapp
 * Guarda el número de quien ya tiene permiso pero no lo tiene registrado.
 * Sin ese dato el login por número no funciona.
 */
export async function completarWhatsappDeUsuario(req, res, next) {
    try {
        const { email, whatsapp } = req.body
        if (!email)    throw new AppError('email es requerido', 400, 'BAD_REQUEST')
        if (!whatsapp) throw new AppError('whatsapp es requerido', 400, 'BAD_REQUEST')

        const resultado = await completarWhatsapp(email, whatsapp)
        res.json({ status: 'ok', ...resultado })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /bot/reporte-acceso
 * El alumno reporta que no puede entrar. Guarda el reporte y avisa a la admin
 * por WhatsApp. NO libera ningún taller — eso lo hace la admin tras verificar.
 */
export async function reportarAcceso(req, res, next) {
    try {
        const { email, nombre, whatsapp, motivo, detalle } = req.body
        if (!email)  throw new AppError('email es requerido', 400, 'BAD_REQUEST')
        if (!Object.values(MOTIVOS).includes(motivo)) {
            throw new AppError('motivo inválido', 400, 'BAD_REQUEST')
        }

        const resultado = await crearReporte({ email, nombre, whatsapp, motivo, detalle })
        res.status(201).json({ status: 'ok', ...resultado })
    } catch (err) {
        next(err)
    }
}