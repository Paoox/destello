/**
 * Destello API — Activación de alumnos
 *
 * ── Por qué existe este archivo ──────────────────────────────────────────────
 *
 * Hasta ahora había DOS caminos para marcar a alguien como pagado, y hacían
 * cosas distintas:
 *
 *   · POST /admin/lista-espera/:id/confirmar-pago  → activaba la cuenta Y creaba
 *     la chispa. Correcto.
 *   · PATCH /admin/lista-espera/:id con 'pagado'   → activaba la cuenta pero NO
 *     creaba la chispa. Roto.
 *
 * Sin chispa, `chispaService.getTalleresDelUsuario` no muestra el taller. O sea:
 * la persona pagaba, entraba a la plataforma, y no veía nada — mientras el panel
 * se veía perfectamente en orden porque el estado decía "pagado".
 *
 * La solución no fue parchar el segundo camino, sino que los dos llamen aquí.
 * Un solo lugar donde se decide qué significa "este alumno ya está adentro".
 *
 * Y todo pasa dentro de UNA transacción: antes eran seis operaciones sueltas y
 * si fallaba a la mitad quedaba el desfase "pagado sin activar" que el bot
 * detecta y reporta. Ahora, o se hace todo, o no se hace nada.
 *
 * Los envíos de correo y WhatsApp van FUERA de la transacción, a propósito: que
 * el servidor de correo esté lento no debe tumbar la activación.
 */

import crypto              from 'node:crypto'
import { withTransaction } from '../db/db.js'
import { AppError }        from '../middleware/errorHandler.js'
import { normalizarWhatsapp } from './usuarioService.js'

const DIAS_VIGENCIA_DEFAULT = 30

function segmento() {
    return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)
}

function nuevoCodigoChispa() {
    return `DEST-${segmento()}-${segmento()}`
}

/**
 * ¿Este número ya es de OTRA cuenta?
 *
 * Se consulta con el `q` de la transacción a propósito, para que vea los
 * cambios que se acaban de hacer adentro y no una foto vieja de otra conexión.
 * Si el número ya tiene dueño NO se pisa: sobrescribirlo rompería el login por
 * número de esa otra persona (le daría acceso a la cuenta equivocada).
 */
async function dueñoDelWhatsapp(q, wa, excluirUsuarioId) {
    if (!wa) return null
    const { rows } = await q(
        `SELECT id, email FROM usuarios
         WHERE whatsapp = $1 AND ($2::int IS NULL OR id <> $2)
         LIMIT 1`,
        [wa, excluirUsuarioId ?? null]
    )
    return rows[0] ?? null
}

/**
 * Activa a un alumno a partir de su registro en lista_espera.
 *
 * Hace, en una sola transacción:
 *   1. Crea o reutiliza su cuenta y la deja en 'activo'
 *   2. Le crea la chispa del taller (o reutiliza la que ya tenga vigente)
 *   3. Marca su lista_espera como 'pagado'
 *   4. Registra el pago en la tabla `pagos`
 *
 * @param {number|string} listaEsperaId
 * @param {object}  opts
 * @param {string}  opts.actor      quién lo activó (queda en el registro del pago)
 * @param {object}  opts.pago       { monto, metodo, banco, titular, folio, nota }
 *                                  monto ausente → se toma el precio del taller
 *                                  metodo ausente → 'transferencia'
 * @param {number}  opts.diasVigencia  vigencia de la chispa (default 30)
 *
 * @returns {Promise<object>} { usuario, registro, chispaCode, chispaNueva, avisoWa, pagoId }
 */
export async function activarAlumno(listaEsperaId, opts = {}) {
    const {
        actor        = 'admin',
        pago         = {},
        diasVigencia = DIAS_VIGENCIA_DEFAULT,
    } = opts

    return withTransaction(async (q) => {
        // ── 1. El registro de lista de espera, con datos del taller ──────────
        const { rows: regs } = await q(
            `SELECT le.*, t.nombre AS taller_nombre, t.precio AS taller_precio
             FROM lista_espera le
             LEFT JOIN talleres t ON t.id = le.taller_id
             WHERE le.id = $1
             FOR UPDATE OF le`,
            [listaEsperaId]
        )
        if (!regs.length) throw new AppError('Registro no encontrado', 404, 'NOT_FOUND')
        const reg = regs[0]

        // El correo es la identidad del alumno (es el destino de la FK de
        // chispas). Sin él no hay a quién colgarle el taller.
        const email = reg.email ? reg.email.toLowerCase().trim() : null
        if (!email) {
            throw new AppError(
                'Este registro no tiene correo; no se puede crear la cuenta.',
                400, 'NO_EMAIL'
            )
        }

        const wa = normalizarWhatsapp(reg.whatsapp)

        // ── 2. Cuenta: buscar por correo O por whatsapp, crear si no existe ──
        // Los casts explícitos no son adorno: sin ellos Postgres no puede
        // deducir el tipo de $1 cuando el parámetro se usa dentro de LOWER()
        // y de una comparación con NULL, y truena con 42P18.
        const { rows: encontrados } = await q(
            `SELECT * FROM usuarios
             WHERE LOWER(email) = $1::text
                OR ($2::text IS NOT NULL AND whatsapp = $2::text)
             LIMIT 1`,
            [email, wa]
        )

        const dueñoWa  = await dueñoDelWhatsapp(q, wa, encontrados[0]?.id ?? null)
        const waUsable = dueñoWa ? null : wa
        const avisoWa  = dueñoWa
            ? `El número ${wa} ya está ligado a la cuenta ${dueñoWa.email}, así que no se copió a ${email}.`
            : null

        let usuario
        if (encontrados.length) {
            const { rows } = await q(
                `UPDATE usuarios
                    SET estado       = 'activo',
                        activado_por = COALESCE(activado_por, $4),
                        nombre       = COALESCE(nombre,   $1),
                        whatsapp     = COALESCE(whatsapp, $2),
                        updated_at   = NOW()
                  WHERE id = $3
                RETURNING *`,
                [reg.nombre, waUsable, encontrados[0].id, actor]
            )
            usuario = rows[0]
        } else {
            const { rows } = await q(
                `INSERT INTO usuarios (email, nombre, whatsapp, estado, activado_por, origen)
                 VALUES ($1, $2, $3, 'activo', $4, 'admin')
                 RETURNING *`,
                [email, reg.nombre, waUsable, actor]
            )
            usuario = rows[0]
        }
        // `activado_at` no se escribe aquí: lo estampa el trigger de la
        // migración 003, para que ningún camino se pueda olvidar de ponerlo.

        // ── 3. Chispa del taller ────────────────────────────────────────────
        let chispaCode  = null
        let chispaNueva = false

        if (reg.taller_id) {
            const { rows: vigentes } = await q(
                `SELECT code FROM chispas
                  WHERE LOWER(usuario_email) = LOWER($1)
                    AND taller_id = $2
                    AND revoked = FALSE
                    AND (expires_at IS NULL OR expires_at > NOW())
                  LIMIT 1`,
                [usuario.email, reg.taller_id]
            )

            if (vigentes.length) {
                chispaCode = vigentes[0].code
            } else {
                chispaCode      = nuevoCodigoChispa()
                chispaNueva     = true
                const expiresAt = diasVigencia != null
                    ? new Date(Date.now() + diasVigencia * 86_400_000)
                    : null
                await q(
                    `INSERT INTO chispas
                        (code, taller_id, taller_nombre, expires_at,
                         usuario_nombre, usuario_email, usuario_wa, created_by)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [chispaCode, reg.taller_id, reg.taller_nombre, expiresAt,
                     usuario.nombre, usuario.email, usuario.whatsapp, actor]
                )
            }
        }

        // ── 4. lista_espera → pagado ────────────────────────────────────────
        // `pagado_at` y el evento los pone el trigger, no hace falta escribirlos.
        await q(
            `UPDATE lista_espera
                SET estado = 'pagado', pagado_por = COALESCE(pagado_por, $2)
              WHERE id = $1`,
            [listaEsperaId, actor]
        )

        // ── 5. El pago ──────────────────────────────────────────────────────
        // Antes el dinero no existía como dato: el monto vivía como texto libre
        // dentro de reportes_acceso.detalle y no se podía ni sumar.
        const metodo = pago.metodo ?? 'transferencia'
        const monto  = pago.monto != null
            ? Number(pago.monto)
            : (metodo === 'cortesia' ? 0 : (reg.taller_precio ?? 0))

        const { rows: pagoRows } = await q(
            `INSERT INTO pagos
                (usuario_email, lista_espera_id, taller_id, monto, metodo,
                 banco, titular, folio, estado, verificado_por, nota, origen)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'verificado', $9, $10, 'admin')
             RETURNING id`,
            [usuario.email, listaEsperaId, reg.taller_id, monto, metodo,
             pago.banco ?? null, pago.titular ?? null, pago.folio ?? null,
             actor, pago.nota ?? null]
        )

        return {
            usuario,
            registro:   { ...reg, estado: 'pagado' },
            chispaCode,
            chispaNueva,
            avisoWa,
            pagoId:     pagoRows[0].id,
            waDestino:  wa,
        }
    })
}
