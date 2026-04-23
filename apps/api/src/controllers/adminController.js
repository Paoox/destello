/**
 * Destello API — Admin Controller
 * Maneja: login admin, chispas, talleres, lista de espera.
 * Los resplandores tienen su propio controller → resplandorController.js
 */
import { verifyAdminPassword, signAdminToken } from '../services/adminAuthService.js'
import * as chispaService      from '../services/chispaService.js'
import * as resplandorService  from '../services/resplandorService.js'
import * as tallerService      from '../services/tallerService.js'
import * as listaEsperaService from '../services/listaEsperaService.js'
import { query }               from '../db.js'
import { AppError }            from '../middleware/errorHandler.js'

// ── Auth admin ────────────────────────────────────────────────────────────────

export async function adminLogin(req, res, next) {
    try {
        const { password } = req.body
        if (!password) throw new AppError('Contraseña requerida', 400, 'BAD_REQUEST')
        const valid = await verifyAdminPassword(password)
        if (!valid) throw new AppError('Contraseña incorrecta', 401, 'UNAUTHORIZED')
        res.json({ status: 'ok', adminToken: signAdminToken() })
    } catch (err) { next(err) }
}

// ── Chispas ───────────────────────────────────────────────────────────────────

export async function generateChispa(req, res, next) {
    try {
        const { tallerId, expiresInDays, isDemo, prefix } = req.body
        if (!tallerId) throw new AppError('tallerId es requerido', 400, 'BAD_REQUEST')
        const chispa = await chispaService.createChispa({ tallerId, expiresInDays, isDemo, prefix })
        res.status(201).json({ status: 'ok', chispa })
    } catch (err) { next(err) }
}

export async function generateBatch(req, res, next) {
    try {
        const { tallerId, quantity = 1, expiresInDays, prefix } = req.body
        if (!tallerId) throw new AppError('tallerId es requerido', 400, 'BAD_REQUEST')
        if (quantity < 1 || quantity > 500) throw new AppError('quantity: 1-500', 400, 'BAD_REQUEST')
        const chispas = []
        for (let i = 0; i < quantity; i++) {
            chispas.push(await chispaService.createChispa({ tallerId, expiresInDays, prefix }))
        }
        res.status(201).json({ status: 'ok', chispas, total: chispas.length })
    } catch (err) { next(err) }
}

export async function listChispas(req, res, next) {
    try {
        const { tallerId, activeOnly } = req.query
        const chispas = await chispaService.listChispas({ tallerId, activeOnly: activeOnly === 'true' })
        res.json({ status: 'ok', chispas, total: chispas.length })
    } catch (err) { next(err) }
}

export async function getStats(_req, res, next) {
    try {
        const stats = await chispaService.getStats()
        res.json({ status: 'ok', stats })
    } catch (err) { next(err) }
}

export async function revokeChispa(req, res, next) {
    try {
        const chispa = await chispaService.revokeChispa(req.params.code)
        if (!chispa) return next(new AppError('Chispa no encontrada', 404, 'NOT_FOUND'))
        res.json({ status: 'ok', message: 'Chispa revocada' })
    } catch (err) { next(err) }
}

// ── Talleres ──────────────────────────────────────────────────────────────────

/**
 * GET /admin/talleres/stats
 * Devuelve cada taller con conteos de lista de espera
 * (pendientes, confirmados, total) ordenados por demanda desc.
 */
export async function getTalleresStats(_req, res, next) {
    try {
        const { rows } = await query(`
            SELECT
                t.id,
                t.nombre,
                t.estado,
                COUNT(le.id) FILTER (WHERE le.estado = 'pendiente')  AS pendientes,
                COUNT(le.id) FILTER (WHERE le.estado = 'confirmado') AS confirmados,
                COUNT(le.id)                                          AS total_espera
            FROM talleres t
                     LEFT JOIN lista_espera le ON le.taller_id = t.id::text
            GROUP BY t.id
            ORDER BY total_espera DESC, t.nombre ASC
        `)
        res.json({ status: 'ok', stats: rows })
    } catch (err) { next(err) }
}

export async function listTalleres(_req, res, next) {
    try {
        const talleres = await tallerService.listTodosLosTalleres()
        res.json({ status: 'ok', talleres })
    } catch (err) { next(err) }
}

export async function createTaller(req, res, next) {
    try {
        const { nombre, descripcion, precio, horario, categoria } = req.body
        if (!nombre) throw new AppError('nombre es requerido', 400, 'BAD_REQUEST')
        const taller = await tallerService.createTaller({ nombre, descripcion, precio, horario, categoria })
        res.status(201).json({ status: 'ok', taller })
    } catch (err) { next(err) }
}

export async function updateTaller(req, res, next) {
    try {
        const taller = await tallerService.updateTaller(req.params.id, req.body)
        if (!taller) return next(new AppError('Taller no encontrado', 404, 'NOT_FOUND'))
        res.json({ status: 'ok', taller })
    } catch (err) { next(err) }
}

// ── Lista de espera ───────────────────────────────────────────────────────────

/**
 * Confirma el lugar en lista de espera SIN generar código.
 * Solo actualiza estado → 'confirmado'.
 * TODO: aquí irá el envío de email con Resend (detalles del taller + formas de pago).
 */
export async function confirmarLugar(req, res, next) {
    try {
        const { id } = req.params
        const registro = await listaEsperaService.actualizarEstado(id, 'confirmado')
        if (!registro) return next(new AppError('Registro no encontrado', 404, 'NOT_FOUND'))
        res.json({
            status:  'ok',
            registro,
            mensaje: 'Lugar confirmado. Email de confirmación pendiente de configurar.',
        })
    } catch (err) { next(err) }
}

export async function listEspera(_req, res, next) {
    try {
        const lista = await listaEsperaService.listTodas()
        res.json({ status: 'ok', lista })
    } catch (err) { next(err) }
}

/**
 * Confirmar cupo desde lista de espera.
 * tipo = 'chispa'     → usuario ya tiene cuenta, genera chispa de taller
 * tipo = 'resplandor' → usuario sin cuenta, genera resplandor de invitación
 */
export async function confirmarCupo(req, res, next) {
    try {
        const { id } = req.params
        const { expiresInDays = 30, tipo = 'chispa' } = req.body

        const { rows } = await query('SELECT * FROM lista_espera WHERE id = $1', [id])
        const registro  = rows[0]
        if (!registro) return next(new AppError('Registro no encontrado', 404, 'NOT_FOUND'))

        if (tipo === 'resplandor') {
            if (!registro.email) throw new AppError('El registro no tiene email', 400, 'BAD_REQUEST')
            const resplandor = await resplandorService.createResplandor({
                email:         registro.email,
                nombre:        registro.nombre,
                tallerId:      registro.taller_id,
                expiresInDays: 7,
                createdBy:     'admin',
            })
            await listaEsperaService.actualizarEstado(id, 'confirmado')
            res.json({
                status:    'ok',
                tipo:      'resplandor',
                resplandor,
                mensaje:   'Cupo confirmado. Resplandor: ' + resplandor.code,
            })
        } else {
            const chispa = await chispaService.createChispa({
                tallerId: registro.taller_id, expiresInDays, createdBy: 'admin',
            })
            await listaEsperaService.actualizarEstado(id, 'confirmado')
            res.json({
                status:  'ok',
                tipo:    'chispa',
                chispa,
                mensaje: 'Cupo confirmado. Chispa: ' + chispa.code,
            })
        }
    } catch (err) { next(err) }
}