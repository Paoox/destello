/**
 * Destello API — Admin Routes
 *
 * POST   /admin/login              → pública — emite adminToken
 * POST   /admin/chispas            → genera una chispa (admin)
 * POST   /admin/chispas/batch      → genera N chispas (admin)
 * GET    /admin/chispas            → lista todas (admin)
 * GET    /admin/chispas/stats      → estadísticas (admin)
 * DELETE /admin/chispas/:code      → revoca (admin)
 *
 * GET    /admin/talleres           → lista todos (admin)
 * POST   /admin/talleres           → crea taller nuevo (admin)
 * PUT    /admin/talleres/:id       → actualiza taller (admin)
 *
 * GET    /admin/lista-espera       → lista de espera completa (admin)
 * PATCH  /admin/lista-espera/:id   → actualiza estado (admin)
 */
import { Router }            from 'express'
import { adminLogin }        from '../controllers/adminController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import * as chispaCtrl       from '../controllers/chispasController.js'
import { listTodosLosTalleres, crearTaller, actualizarTaller, getTallerById } from '../services/tallerService.js'
import { AppError }          from '../middleware/errorHandler.js'
import { query }             from '../db/db.js'
import { sendConfirmacionTaller, sendResplandor } from '../services/mailService.js'
import crypto                from 'node:crypto'

const router = Router()

// ── Pública ───────────────────────────────────────────────
router.post('/login', adminLogin)

// ── Protegidas con adminToken ─────────────────────────────
router.use(authenticateAdmin)

// Chispas
router.post('/chispas',         chispaCtrl.generateChispa)
router.post('/chispas/batch',   chispaCtrl.generateBatch)
router.get('/chispas',          chispaCtrl.listChispas)
router.get('/chispas/stats',    chispaCtrl.getStats)
router.delete('/chispas/:code', chispaCtrl.revokeChispa)

// Talleres
router.get('/talleres', async (_req, res, next) => {
    try {
        const talleres = await listTodosLosTalleres()
        res.json({ status: 'ok', talleres })
    } catch (err) { next(err) }
})

router.post('/talleres', async (req, res, next) => {
    try {
        const { nombre } = req.body
        if (!nombre) throw new AppError('nombre es requerido', 400, 'BAD_REQUEST')
        const taller = await crearTaller(req.body)
        res.status(201).json({ status: 'ok', taller })
    } catch (err) { next(err) }
})

router.put('/talleres/:id', async (req, res, next) => {
    try {
        const taller = await actualizarTaller(req.params.id, req.body)
        if (!taller) throw new AppError('Taller no encontrado', 404, 'NOT_FOUND')
        res.json({ status: 'ok', taller })
    } catch (err) { next(err) }
})

// Lista de espera (admin)
router.get('/lista-espera', async (_req, res, next) => {
    try {
        const { rows } = await query(
            `SELECT le.*, t.nombre AS taller_nombre
             FROM lista_espera le
             LEFT JOIN talleres t ON t.id = le.taller_id
             ORDER BY le.created_at DESC`
        )
        res.json({ status: 'ok', lista: rows })
    } catch (err) { next(err) }
})

router.patch('/lista-espera/:id', async (req, res, next) => {
    try {
        const { estado } = req.body
        if (!estado) throw new AppError('estado es requerido', 400, 'BAD_REQUEST')
        const { rows } = await query(
            `UPDATE lista_espera SET estado = $2 WHERE id = $1 RETURNING *`,
            [req.params.id, estado]
        )
        if (!rows.length) throw new AppError('Registro no encontrado', 404, 'NOT_FOUND')
        res.json({ status: 'ok', registro: rows[0] })
    } catch (err) { next(err) }
})

router.get('/resplandores/all', async (_req, res, next) => {
    try {
        const { rows } = await query(
            `SELECT r.*, u.nombre AS usuario_nombre
             FROM resplandores r
             LEFT JOIN usuarios u ON u.email = r.email
             ORDER BY r.created_at DESC`
        )
        res.json({ status: 'ok', resplandores: rows })
    } catch (err) { next(err) }
})

// ── Resplandores (admin) ──────────────────────────────────


/**
 * GET /admin/resplandores?email=xxx
 * Lista los resplandores de un usuario por correo.
 */
router.get('/resplandores', async (req, res, next) => {
    try {
        const { email } = req.query
        if (!email) throw new AppError('email es requerido', 400, 'BAD_REQUEST')

        const { rows: users } = await query(
            `SELECT id, email, nombre, whatsapp, estado FROM usuarios WHERE email = $1`,
            [email.toLowerCase().trim()]
        )
        const usuario = users[0] ?? null

        const { rows: resplandores } = await query(
            `SELECT * FROM resplandores WHERE email = $1 ORDER BY created_at DESC`,
            [email.toLowerCase().trim()]
        )

        res.json({ status: 'ok', usuario, resplandores })
    } catch (err) { next(err) }
})

/**
 * POST /admin/resplandores
 * Crea un nuevo resplandor para el usuario (email debe existir).
 * Solo permite crear si no tiene uno activo/expirado sin revocar.
 * Body: { email }
 */
router.post('/resplandores', async (req, res, next) => {
    try {
        const { email } = req.body
        if (!email) throw new AppError('email es requerido', 400, 'BAD_REQUEST')
        const emailNorm = email.toLowerCase().trim()

        // Verificar si ya tiene un resplandor activo o expirado (no revocado, no usado)
        const { rows: existentes } = await query(
            `SELECT * FROM resplandores
             WHERE email = $1 AND revoked = FALSE AND used = FALSE`,
            [emailNorm]
        )
        if (existentes.length > 0) {
            throw new AppError(
                'El usuario ya tiene un resplandor activo. Revócalo primero para crear uno nuevo.',
                409, 'CONFLICT'
            )
        }

        // Generar código: RES-XXXX-XXXX
        const seg  = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)
        const code = `RES-${seg()}-${seg()}`

        // Buscar datos del usuario para el correo
        const { rows: users } = await query(
            `SELECT nombre FROM usuarios WHERE email = $1`,
            [emailNorm]
        )
        const nombre = users[0]?.nombre ?? ''

        // Guardar resplandor
        const { rows } = await query(
            `INSERT INTO resplandores (code, email, created_at)
             VALUES ($1, $2, NOW())
             RETURNING *`,
            [code, emailNorm]
        )
        const resplandor = rows[0]

        // Enviar correo automáticamente
        try {
            await sendResplandor({ to: emailNorm, nombre, code })
            resplandor.enviado = true
        } catch { resplandor.enviado = false }

        res.status(201).json({ status: 'ok', code, resplandor })
    } catch (err) { next(err) }
})

/**
 * POST /admin/resplandores/:code/reenviar
 * Reenvía un resplandor existente al correo del usuario.
 */
router.post('/resplandores/:code/reenviar', async (req, res, next) => {
    try {
        const { rows } = await query(
            `SELECT r.*, u.nombre FROM resplandores r
             JOIN usuarios u ON u.email = r.email
             WHERE r.code = $1`,
            [req.params.code]
        )
        if (!rows.length) throw new AppError('Resplandor no encontrado', 404, 'NOT_FOUND')
        const r = rows[0]

        await sendResplandor({ to: r.email, nombre: r.nombre ?? '', code: r.code })
        res.json({ status: 'ok', message: `Resplandor reenviado a ${r.usuario_email}` })
    } catch (err) { next(err) }
})

/**
 * DELETE /admin/resplandores/:code
 * Revoca un resplandor. Queda en historial pero no puede usarse.
 * Al revocar, el admin puede crear uno nuevo.
 */
router.delete('/resplandores/:code', async (req, res, next) => {
    try {
        const { rows } = await query(
            `UPDATE resplandores SET revoked = TRUE WHERE code = $1 RETURNING *`,
            [req.params.code]
        )
        if (!rows.length) throw new AppError('Resplandor no encontrado', 404, 'NOT_FOUND')
        res.json({ status: 'ok', message: `Resplandor ${req.params.code} revocado` })
    } catch (err) { next(err) }
})

// ── Correos (admin) ────────────────────────────────────────

/**
 * POST /admin/mail/confirmacion-taller
 * Envía el correo de confirmación de taller con la chispa.
 * Body: { to, nombre, tallerId, chispaCode }
 */
router.post('/mail/confirmacion-taller', async (req, res, next) => {
    try {
        const { to, nombre, tallerId, chispaCode } = req.body
        if (!to || !tallerId || !chispaCode) {
            throw new AppError('to, tallerId y chispaCode son requeridos', 400, 'BAD_REQUEST')
        }
        const taller = await getTallerById(tallerId)
        if (!taller) throw new AppError('Taller no encontrado', 404, 'NOT_FOUND')

        await sendConfirmacionTaller({ to, nombre: nombre || '', taller, chispaCode })
        res.json({ status: 'ok', message: `Correo enviado a ${to}` })
    } catch (err) { next(err) }
})

/**
 * POST /admin/mail/resplandor
 * Envía un resplandor (código de acceso para crear cuenta) por correo.
 * Body: { to, nombre, code }
 */
router.post('/mail/resplandor', async (req, res, next) => {
    try {
        const { to, nombre, code } = req.body
        if (!to || !code) throw new AppError('to y code son requeridos', 400, 'BAD_REQUEST')

        await sendResplandor({ to, nombre: nombre || '', code })
        res.json({ status: 'ok', message: `Resplandor enviado a ${to}` })
    } catch (err) { next(err) }
})

export default router