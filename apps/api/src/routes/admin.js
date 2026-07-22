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
 * GET    /admin/talleres/stats     → conteos lista de espera por taller (admin)
 * GET    /admin/talleres           → lista todos (admin)
 * POST   /admin/talleres           → crea taller nuevo (admin)
 * PUT    /admin/talleres/:id       → actualiza taller (admin)
 *
 * GET    /admin/lista-espera       → lista de espera completa (admin)
 * PATCH  /admin/lista-espera/:id   → actualiza estado (admin)
 *
 * POST   /admin/send-wa            → envía WA desde el bot (admin)
 */
import { Router }            from 'express'
import { adminLogin, getTalleresStats } from '../controllers/adminController.js'
import { authenticateAdmin } from '../middleware/authenticateAdmin.js'
import * as chispaCtrl       from '../controllers/chispasController.js'
import { crearTaller, actualizarTaller, getTallerById } from '../services/tallerService.js'
import { AppError }          from '../middleware/errorHandler.js'
import { query }             from '../db/db.js'
import { sendConfirmacionTaller, sendConfirmacionLugar, sendResplandor, sendBienvenida } from '../services/mailService.js'
import { sendWhatsapp }      from '../services/botService.js'
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

// Talleres — stats ANTES de /:id para evitar conflicto de rutas
router.get('/talleres/stats', getTalleresStats)

router.get('/talleres', async (_req, res, next) => {
    try {
        // Incluye "inscritos" = chispas emitidas (no revocadas) por taller.
        // Sirve para el control de cupo (máx 20) y evitar reventa.
        const { rows } = await query(
            `SELECT t.*, COALESCE(ch.inscritos, 0)::int AS inscritos
             FROM talleres t
             LEFT JOIN (
                 SELECT taller_id, COUNT(*) AS inscritos
                 FROM chispas
                 WHERE revoked = FALSE
                 GROUP BY taller_id
             ) ch ON ch.taller_id = t.id
             ORDER BY t.created_at DESC`
        )
        res.json({ status: 'ok', talleres: rows })
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
            `SELECT le.*,
                    t.nombre       AS taller_nombre,
                    t.precio       AS taller_precio,
                    t.horario      AS taller_horario,
                    t.fecha_inicio AS taller_fecha,
                    t.descripcion  AS taller_descripcion,
                    EXISTS (
                        SELECT 1 FROM resplandores r
                        WHERE LOWER(r.email) = LOWER(le.email)
                          AND r.used = FALSE AND r.revoked = FALSE
                    ) AS tiene_resplandor
             FROM lista_espera le
                      LEFT JOIN talleres t ON t.id = le.taller_id
             ORDER BY le.created_at DESC`
        )
        res.json({ status: 'ok', lista: rows })
    } catch (err) { next(err) }
})

/**
 * PATCH /admin/lista-espera/:id
 * Cambia el estado desde el selector del panel.
 *
 * ⚠️ Marcar 'pagado' DEBE activar también al usuario. Si solo se cambiara el
 * estado de la lista, la persona quedaría pagada pero con `usuarios.estado =
 * 'espera'`, y el login por número la rechazaría (phoneAuthController exige
 * 'activo'). Este era un desfase real: el selector y el botón "confirmar pago"
 * hacían cosas distintas.
 */
router.patch('/lista-espera/:id', async (req, res, next) => {
    try {
        const { estado } = req.body
        if (!estado) throw new AppError('estado es requerido', 400, 'BAD_REQUEST')
        const { rows } = await query(
            `UPDATE lista_espera SET estado = $2 WHERE id = $1 RETURNING *`,
            [req.params.id, estado]
        )
        if (!rows.length) throw new AppError('Registro no encontrado', 404, 'NOT_FOUND')

        const registro = rows[0]
        let usuarioActivado = false

        if (estado === 'pagado' && registro.email) {
            const { rows: u } = await query(
                `UPDATE usuarios
                 SET estado   = 'activo',
                     whatsapp = COALESCE(whatsapp, $2),
                     nombre   = COALESCE(nombre,   $3)
                 WHERE LOWER(email) = LOWER($1)
                 RETURNING id`,
                [registro.email, registro.whatsapp || null, registro.nombre || null]
            )
            usuarioActivado = u.length > 0
        }

        res.json({ status: 'ok', registro, usuarioActivado })
    } catch (err) { next(err) }
})

/**
 * POST /admin/lista-espera/:id/confirmar-lugar
 * Confirma el lugar → cambia estado a 'confirmado' y envía correo con
 * detalles del taller + métodos de pago (sin chispa aún).
 */
router.post('/lista-espera/:id/confirmar-lugar', async (req, res, next) => {
    try {
        // Obtener el registro con info del taller
        const { rows } = await query(
            `SELECT le.*, t.nombre AS taller_nombre, t.descripcion AS taller_descripcion,
                    t.fecha_inicio AS taller_fecha, t.horario AS taller_horario,
                    t.precio AS taller_precio
             FROM lista_espera le
                      LEFT JOIN talleres t ON t.id = le.taller_id
             WHERE le.id = $1`,
            [req.params.id]
        )
        if (!rows.length) throw new AppError('Registro no encontrado', 404, 'NOT_FOUND')
        const reg = rows[0]

        // Actualizar estado a confirmado
        await query(
            `UPDATE lista_espera SET estado = 'cupo_confirmado' WHERE id = $1`,
            [req.params.id]
        )

        // Enviar correo de confirmación de lugar (sin chispa)
        const taller = {
            nombre:           reg.taller_nombre      ?? reg.taller_id,
            descripcion:      reg.taller_descripcion ?? null,
            fecha_disponible: reg.taller_fecha       ?? null,
            horario:          reg.taller_horario     ?? null,
            precio:           reg.taller_precio      ?? 0,
        }

        let enviado = false
        try {
            await sendConfirmacionLugar({ to: reg.email, nombre: reg.nombre ?? '', taller })
            enviado = true
        } catch (mailErr) {
            console.error('[mail] Error al enviar confirmación de lugar:', mailErr.message)
        }

        res.json({ status: 'ok', mensaje: 'Lugar confirmado', enviado })
    } catch (err) { next(err) }
})

/**
 * POST /admin/lista-espera/:id/confirmar
 * Genera resplandor o chispa y envía el código por correo.
 * Body: { tipo: 'resplandor' | 'chispa', expiresInDays?: number }
 */
router.post('/lista-espera/:id/confirmar', async (req, res, next) => {
    try {
        const { tipo = 'resplandor', expiresInDays = 30 } = req.body

        // Obtener el registro con info del taller
        const { rows } = await query(
            `SELECT le.*, t.nombre AS taller_nombre, t.descripcion AS taller_descripcion,
                    t.fecha_inicio AS taller_fecha, t.horario AS taller_horario,
                    t.precio AS taller_precio
             FROM lista_espera le
                      LEFT JOIN talleres t ON t.id = le.taller_id
             WHERE le.id = $1`,
            [req.params.id]
        )
        if (!rows.length) throw new AppError('Registro no encontrado', 404, 'NOT_FOUND')
        const reg = rows[0]

        const taller = {
            id:               reg.taller_id,
            nombre:           reg.taller_nombre      ?? reg.taller_id,
            descripcion:      reg.taller_descripcion ?? null,
            fecha_disponible: reg.taller_fecha       ?? null,
            horario:          reg.taller_horario     ?? null,
            precio:           reg.taller_precio      ?? 0,
        }

        const seg = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)

        if (tipo === 'chispa') {
            // Generar chispa
            const code      = `DEST-${seg()}-${seg()}`
            const expiresAt = expiresInDays
                ? new Date(Date.now() + expiresInDays * 86400000)
                : null

            await query(
                `INSERT INTO chispas
                    (code, taller_id, expires_at, usuario_nombre, usuario_email, usuario_wa)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [code, reg.taller_id, expiresAt, reg.nombre, reg.email, reg.whatsapp]
            )

            // Enviar correo con chispa
            try {
                await sendConfirmacionTaller({ to: reg.email, nombre: reg.nombre ?? '', taller, chispaCode: code })
            } catch (mailErr) {
                console.error('[mail] Error al enviar chispa:', mailErr.message)
            }

            return res.status(201).json({ status: 'ok', chispa: { code } })
        }

        // Generar resplandor
        const { rows: existentes } = await query(
            `SELECT * FROM resplandores WHERE email = $1 AND revoked = FALSE AND used = FALSE`,
            [reg.email]
        )
        if (existentes.length > 0) {
            throw new AppError('El usuario ya tiene un resplandor activo.', 409, 'CONFLICT')
        }

        const code = `RES-${seg()}-${seg()}`
        await query(
            `INSERT INTO resplandores (code, email, created_at) VALUES ($1, $2, NOW())`,
            [code, reg.email]
        )

        // Enviar correo con resplandor
        try {
            await sendResplandor({ to: reg.email, nombre: reg.nombre ?? '', code })
        } catch (mailErr) {
            console.error('[mail] Error al enviar resplandor:', mailErr.message)
        }

        res.status(201).json({ status: 'ok', resplandor: { code } })
    } catch (err) { next(err) }
})

/**
 * POST /admin/lista-espera/:id/confirmar-pago
 * Flujo nuevo (pago confirmado). En una sola acción:
 *   1. Crea/activa la cuenta en `usuarios` (dedup por correo O whatsapp).
 *   2. Genera la Chispa del taller (tras bambalinas) ligada al usuario.
 *   3. Cambia lista_espera a 'pagado'.
 *   4. Envía bienvenida por correo (botón + QR a /login) y por WhatsApp (URL).
 * El usuario no captura códigos: al entrar por Google/número el taller ya aparece.
 */
router.post('/lista-espera/:id/confirmar-pago', async (req, res, next) => {
    try {
        const { rows } = await query(
            `SELECT le.*, t.nombre AS taller_nombre
             FROM lista_espera le
                      LEFT JOIN talleres t ON t.id = le.taller_id
             WHERE le.id = $1`,
            [req.params.id]
        )
        if (!rows.length) throw new AppError('Registro no encontrado', 404, 'NOT_FOUND')
        const reg = rows[0]

        const emailNorm = reg.email ? reg.email.toLowerCase().trim() : null
        const wa        = reg.whatsapp ? String(reg.whatsapp).replace(/\D/g, '').slice(-10) : null

        // Hoy el correo es la identidad del usuario (FK de chispas). Es obligatorio.
        if (!emailNorm) {
            throw new AppError('Este registro no tiene correo; no se puede crear la cuenta.', 400, 'NO_EMAIL')
        }

        // 1. Crear o reutilizar la cuenta (dedup por correo O whatsapp)
        const { rows: encontrados } = await query(
            `SELECT * FROM usuarios
             WHERE email = $1 OR ($2::text IS NOT NULL AND whatsapp = $2)
             LIMIT 1`,
            [emailNorm, wa]
        )

        let usuario
        if (encontrados.length) {
            const { rows: upd } = await query(
                `UPDATE usuarios
                 SET estado   = 'activo',
                     nombre   = COALESCE(nombre, $2),
                     whatsapp = COALESCE(whatsapp, $3),
                     email    = COALESCE(email, $1)
                 WHERE id = $4
                 RETURNING *`,
                [emailNorm, reg.nombre, wa, encontrados[0].id]
            )
            usuario = upd[0]
        } else {
            const { rows: ins } = await query(
                `INSERT INTO usuarios (email, nombre, whatsapp, estado)
                 VALUES ($1, $2, $3, 'activo')
                 RETURNING *`,
                [emailNorm, reg.nombre, wa]
            )
            usuario = ins[0]
        }

        // 2. Chispa automática del taller (si aún no tiene una activa de ese taller)
        let chispaCode = null
        if (reg.taller_id) {
            const { rows: existentes } = await query(
                `SELECT code FROM chispas
                 WHERE usuario_email = $1 AND taller_id = $2 AND used = FALSE AND revoked = FALSE
                 LIMIT 1`,
                [usuario.email, reg.taller_id]
            )
            if (existentes.length) {
                chispaCode = existentes[0].code
            } else {
                const seg       = () => crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)
                chispaCode      = `DEST-${seg()}-${seg()}`
                const expiresAt = new Date(Date.now() + 30 * 86400000)   // 30 días
                await query(
                    `INSERT INTO chispas
                        (code, taller_id, taller_nombre, expires_at, usuario_nombre, usuario_email, usuario_wa)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [chispaCode, reg.taller_id, reg.taller_nombre, expiresAt, usuario.nombre, usuario.email, usuario.whatsapp]
                )
            }
        }

        // 3. lista_espera → pagado
        await query(`UPDATE lista_espera SET estado = 'pagado' WHERE id = $1`, [req.params.id])

        // 4. Bienvenida por correo + WhatsApp (no bloquean la respuesta si fallan)
        let mailEnviado = false
        let waEnviado   = false

        try {
            await sendBienvenida({ to: usuario.email, nombre: usuario.nombre ?? reg.nombre ?? '' })
            mailEnviado = true
        } catch (e) { console.error('[bienvenida mail]', e.message) }

        if (wa) {
            try {
                const primerNombre = (usuario.nombre ?? reg.nombre ?? '').split(' ')[0]
                const msg =
                    `✦ *Destello*\n\n` +
                    `¡Hola ${primerNombre}! Tu pago quedó *confirmado*. 🎉\n\n` +
                    `Ya puedes crear tu cuenta y entrar aquí:\n` +
                    `https://destello.courses/login\n\n` +
                    `Entra con Google o con tu número. ¡Nos vemos dentro! 🌟`
                await sendWhatsapp(wa, msg)
                waEnviado = true
            } catch (e) { console.error('[bienvenida wa]', e.message) }
        }

        res.json({
            status:      'ok',
            usuario:     { id: usuario.id, email: usuario.email, whatsapp: usuario.whatsapp },
            chispa:      chispaCode,
            mailEnviado,
            waEnviado,
        })
    } catch (err) { next(err) }
})

router.get('/resplandores/all', async (_req, res, next) => {
    try {
        const { rows } = await query(
            `SELECT r.*, u.nombre AS usuario_nombre, u.whatsapp AS usuario_whatsapp
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
            `SELECT r.*,
                    COALESCE(u.nombre, le.nombre) AS nombre
             FROM resplandores r
             LEFT JOIN usuarios    u  ON u.email  = r.email
             LEFT JOIN lista_espera le ON le.email = r.email
             WHERE r.code = $1
             LIMIT 1`,
            [req.params.code]
        )
        if (!rows.length) throw new AppError('Resplandor no encontrado', 404, 'NOT_FOUND')
        const r = rows[0]

        await sendResplandor({ to: r.email, nombre: r.nombre ?? '', code: r.code })
        res.json({ status: 'ok', message: `Resplandor reenviado a ${r.email}` })
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

// ── WhatsApp desde el bot ──────────────────────────────────

/**
 * POST /admin/send-wa
 * Envía un mensaje de WhatsApp desde el número del bot (Baileys).
 * Body: { numero, mensaje }
 *   numero:  10 dígitos locales MX (ej: 5577888800)
 *   mensaje: texto a enviar (soporta formato WA con *bold*, etc.)
 *
 * Requiere que el bot esté corriendo y BOT_HTTP_URL esté configurado.
 * Por defecto apunta a http://127.0.0.1:4001 (bot en la misma máquina).
 */
router.post('/send-wa', async (req, res, next) => {
    try {
        const { numero, mensaje } = req.body

        if (!numero || !mensaje) {
            throw new AppError('numero y mensaje son requeridos', 400, 'BAD_REQUEST')
        }

        // Normalizar a 10 dígitos
        const numeroLimpio = String(numero).replace(/\D/g, '').slice(-10)
        if (numeroLimpio.length !== 10) {
            throw new AppError('El número debe tener 10 dígitos (ej: 5577888800)', 400, 'BAD_REQUEST')
        }

        // Formato JID de WhatsApp para México: 521XXXXXXXXXX@s.whatsapp.net
        // Los números móviles MX en WhatsApp llevan el "1" después del código de país
        const jid    = `521${numeroLimpio}@s.whatsapp.net`
        const botUrl = process.env.BOT_HTTP_URL || 'http://127.0.0.1:4001'

        const botRes = await fetch(`${botUrl}/send`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ jid, mensaje }),
        })

        if (!botRes.ok) {
            const errData = await botRes.json().catch(() => ({ error: 'Error desconocido del bot' }))
            throw new AppError(
                errData.error || 'No se pudo enviar el mensaje por WhatsApp',
                502,
                'BOT_ERROR',
            )
        }

        res.json({ status: 'ok', message: `Mensaje enviado a ${numeroLimpio}` })
    } catch (err) { next(err) }
})

export default router