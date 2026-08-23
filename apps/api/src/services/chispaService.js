/**
 * Destello API — Chispa Service (PostgreSQL)
 * ─────────────────────────────────────────────────────────────────────────────
 * Lógica de negocio para chispas (códigos de acceso a talleres).
 * Persiste en la tabla `chispas` de PostgreSQL.
 *
 * Columnas requeridas en la tabla (ejecutar en pgAdmin si faltan):
 *
 *   ALTER TABLE chispas
 *     ADD COLUMN IF NOT EXISTS usuario_nombre TEXT,
 *     ADD COLUMN IF NOT EXISTS taller_nombre  TEXT,
 *     ADD COLUMN IF NOT EXISTS usuario_wa     TEXT;
 */

import crypto    from 'node:crypto'
import { query } from '../db/db.js'
import { hayCupo, sincronizarEstadoCupo } from './cupoService.js'
import { normalizarWhatsapp, asegurarWhatsappLibre } from './usuarioService.js'

// ── Mapper snake_case → camelCase ─────────────────────────────────────────────
// Convierte una fila de PostgreSQL al formato que espera el frontend.
function toChispa(row) {
    if (!row) return null
    return {
        code:          row.code,
        tallerId:      row.taller_id,
        tallerNombre:  row.taller_nombre  ?? null,
        usuarioEmail:  row.usuario_email  ?? null,
        usuarioNombre: row.usuario_nombre ?? null,
        usuarioWa:     row.usuario_wa     ?? null,
        pagoId:        row.pago_id        ?? null,
        createdBy:     row.created_by,
        createdAt:     row.created_at,
        expiresAt:     row.expires_at     ?? null,
        used:          row.used,
        usedBy:        row.used_by        ?? null,
        revoked:       row.revoked,
        isDemo:        row.is_demo,
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomSegment() {
    return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 4)
}

function buildCode(prefix = 'DEST') {
    return `${prefix}-${randomSegment()}-${randomSegment()}`
}

async function uniqueCode(prefix) {
    let attempts = 0
    while (true) {
        const code = buildCode(prefix)
        const { rows } = await query('SELECT 1 FROM chispas WHERE code = $1', [code])
        if (rows.length === 0) return code
        if (++attempts > 10) throw new Error('No se pudo generar código único')
    }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Crea y persiste una nueva chispa.
 */
export async function createChispa({
                                       tallerId,
                                       tallerNombre  = null,
                                       createdBy     = 'admin',
                                       expiresInDays = 30,
                                       prefix        = 'DEST',
                                       isDemo        = false,
                                       usuarioNombre = null,
                                       usuarioEmail  = null,
                                       usuarioWa     = null,
                                   }) {
    if (!tallerId) throw new Error('tallerId es requerido')

    // Normaliza correo/WhatsApp del dueño (si viene) y GARANTIZA que el usuario
    // exista antes de insertar la chispa: la FK chispas_usuario_email_fkey lo exige.
    // Gracias a esto el admin puede asignar un taller/demo con solo correo + número
    // (si el usuario no existe, se crea; si existe, no se pisan sus datos).
    const emailOwner = usuarioEmail ? usuarioEmail.toLowerCase().trim() : null
    let   waOwner    = normalizarWhatsapp(usuarioWa)

    // El número no se puede robar de otra cuenta al asignar una chispa: si ya es
    // de alguien más se lanza WA_EN_USO (409) para que el panel avise a Paola en
    // vez de dejar dos cuentas con el mismo número (rompe el login por número).
    if (waOwner) {
        const propia = emailOwner
            ? (await query('SELECT id FROM usuarios WHERE email = $1', [emailOwner])).rows[0]
            : null
        waOwner = await asegurarWhatsappLibre(waOwner, propia?.id ?? null)
    }

    // Asignar una chispa ES darle permiso de entrar: no tiene sentido darle la
    // llave del taller a alguien que no puede abrir la puerta.
    //
    // Antes el INSERT ponía 'activo' pero el ON CONFLICT no tocaba el estado, así
    // que a quien ya estaba en 'espera' (todos los que llegan por el bot) se le
    // creaba la chispa y aun así no podía entrar — `phoneAuthController` exige
    // 'activo'. Se veía como "le di su acceso y dice que no tiene cuenta".
    if (emailOwner) {
        await query(
            `INSERT INTO usuarios (email, nombre, whatsapp, estado, activado_por, origen)
             VALUES ($1, $2, $3, 'activo', 'admin:chispa', 'admin')
             ON CONFLICT (email) DO UPDATE
               SET nombre       = COALESCE(usuarios.nombre,   EXCLUDED.nombre),
                   whatsapp     = COALESCE(usuarios.whatsapp, EXCLUDED.whatsapp),
                   estado       = 'activo',
                   activado_por = COALESCE(usuarios.activado_por, 'admin:chispa'),
                   updated_at   = NOW()`,
            [emailOwner, usuarioNombre || null, waOwner]
        )
    }

    // ── La chispa APARTA el lugar; el pago lo confirma ──────────────────────
    //
    // Asignar una chispa sin dejar rastro en `lista_espera` dejaba a la persona
    // en tierra de nadie: tenía llave pero no había dónde marcarle el pago, así
    // que su taller nunca aparecía en el Home (ver getTalleresDelUsuario).
    //
    // Por eso al asignar una chispa se asegura su registro en la lista:
    //   · no existe        → se crea (ver estado abajo)
    //   · está 'pendiente' → sube de estado, que es lo que acaba de pasar
    //   · ya está 'pagado' → NO se toca; sería degradarlo
    //
    // ── Las DEMOS también entran (cambio del 22 ago 2026) ──────────────────
    //
    // Antes las demos se saltaban este bloque, con este razonamiento: "no hay
    // pago que esperar y no deben ensuciar la lista con gente que no está
    // formada". Bajo la regla vieja era correcto — una demo era un regalo que
    // no quitaba lugar.
    //
    // La regla cambió: **una cortesía ocupa una silla igual que un pago.** Si
    // no está en la lista, no se cuenta en el cupo, y el taller se sobrevende.
    //
    // La diferencia es el estado con el que entra:
    //   · normal → 'cupo_confirmado'  (lugar apartado, arranca el reloj de pago)
    //   · demo   → 'pagado'           (no hay nada que cobrar; sin reloj de pago)
    //
    // Una demo NO es otro tipo de cosa: es lo mismo con otro método de pago.
    // Por eso queda registrada en `pagos` con metodo='cortesia' y monto=0 — así
    // ocupa su lugar sin inflar los ingresos, y queda constancia de POR QUÉ fue
    // gratis, no solo de que lo fue.
    if (emailOwner && tallerId) {
        const estadoInicial = isDemo ? 'pagado' : 'cupo_confirmado'

        const { rows: yaEnLista } = await query(
            `SELECT id, estado FROM lista_espera
             WHERE LOWER(email) = LOWER($1) AND taller_id = $2
             LIMIT 1`,
            [emailOwner, tallerId]
        )

        // ── Cupo ────────────────────────────────────────────────────────────
        // Solo se valida si esta persona va a ocupar un lugar NUEVO. Quien ya
        // tiene el suyo apartado ('cupo_confirmado') o pagado no debe quedarse
        // fuera por un taller lleno: su silla ya está contada, y bloquearlo
        // sería negarle acceso a algo que ya es suyo.
        const yaOcupaLugar = ['cupo_confirmado', 'confirmado', 'pagado']
            .includes(yaEnLista[0]?.estado)

        if (!yaOcupaLugar) {
            const { hayCupo: hayLugar, motivo } = await hayCupo(tallerId)
            if (!hayLugar) {
                const err = new Error(motivo ?? 'El taller ya está lleno.')
                err.statusCode = 409
                err.code = 'SIN_CUPO'
                throw err
            }
        }

        let listaEsperaId = yaEnLista[0]?.id ?? null

        if (!yaEnLista.length) {
            const { rows: ins } = await query(
                `INSERT INTO lista_espera (email, taller_id, nombre, whatsapp, estado, origen)
                 VALUES ($1, $2, $3, $4, $5, 'admin')
                 RETURNING id`,
                [emailOwner, tallerId, usuarioNombre || null, waOwner, estadoInicial]
            )
            listaEsperaId = ins[0].id
        } else if (yaEnLista[0].estado === 'pendiente' ||
                  (isDemo && yaEnLista[0].estado === 'cupo_confirmado')) {
            await query(
                `UPDATE lista_espera
                 SET estado   = $4,
                     nombre   = COALESCE(nombre, $2),
                     whatsapp = COALESCE(whatsapp, $3)
                 WHERE id = $1`,
                [yaEnLista[0].id, usuarioNombre || null, waOwner, estadoInicial]
            )
        }

        // Cortesía: se deja el renglón en `pagos` para que el cupo y el historial
        // cuadren. Se evita duplicarlo si ya existía uno para esta inscripción.
        if (isDemo && listaEsperaId) {
            await query(
                `INSERT INTO pagos
                    (usuario_email, lista_espera_id, taller_id, monto, metodo,
                     estado, verificado_por, nota, origen)
                 SELECT $1, $2, $3, 0, 'cortesia', 'verificado', 'admin',
                        'Chispa de cortesía otorgada desde el panel', 'admin'
                 WHERE NOT EXISTS (
                     SELECT 1 FROM pagos
                      WHERE lista_espera_id = $2 AND metodo = 'cortesia'
                 )`,
                [emailOwner, listaEsperaId, tallerId]
            )
        }

        await sincronizarEstadoCupo(tallerId)
    }

    const code      = await uniqueCode(prefix.toUpperCase())
    const expiresAt = expiresInDays != null
        ? new Date(Date.now() + expiresInDays * 86_400_000)
        : null

    const { rows } = await query(
        `INSERT INTO chispas
         (code, taller_id, taller_nombre,
          usuario_email, usuario_nombre, usuario_wa,
          created_by, expires_at, is_demo,
          used, revoked, created_at)
         VALUES
             ($1, $2, $3,
              $4, $5, $6,
              $7, $8, $9,
              FALSE, FALSE, NOW())
             RETURNING *`,
        [
            code,
            tallerId,
            tallerNombre  || null,
            emailOwner,
            usuarioNombre || null,
            waOwner,
            createdBy,
            expiresAt,
            Boolean(isDemo),
        ]
    )

    return toChispa(rows[0])
}

/**
 * Lista todas las chispas con filtros opcionales.
 * Ordenadas por fecha de creación descendente.
 */
export async function listChispas({ tallerId, activeOnly } = {}) {
    const conditions = []
    const params     = []

    if (tallerId) {
        params.push(tallerId)
        conditions.push(`taller_id = $${params.length}`)
    }

    if (activeOnly) {
        conditions.push(`used = FALSE AND revoked = FALSE AND (expires_at IS NULL OR expires_at > NOW())`)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

    const { rows } = await query(
        `SELECT * FROM chispas ${where} ORDER BY created_at DESC`,
        params
    )

    return rows.map(toChispa)
}

/**
 * Obtiene una chispa por código.
 */
export async function getChispa(code) {
    const { rows } = await query(
        'SELECT * FROM chispas WHERE code = $1',
        [code?.toUpperCase().trim()]
    )
    return toChispa(rows[0] ?? null)
}

/**
 * Estadísticas globales.
 */
export async function getStats() {
    const { rows } = await query(`
        SELECT
            COUNT(*)                                                                    AS total,
            COUNT(*) FILTER (
                WHERE used = FALSE AND revoked = FALSE
                  AND (expires_at IS NULL OR expires_at > NOW())
            )                                                                           AS active,
            COUNT(*) FILTER (WHERE used = TRUE)                                        AS used,
            COUNT(*) FILTER (WHERE revoked = TRUE)                                     AS revoked,
            COUNT(*) FILTER (
                WHERE used = FALSE AND revoked = FALSE
                  AND expires_at IS NOT NULL AND expires_at <= NOW()
            )                                                                           AS expired,
            COUNT(*) FILTER (WHERE is_demo = TRUE)                                     AS demo
        FROM chispas
    `)

    const r = rows[0]
    return {
        total:   Number(r.total),
        active:  Number(r.active),
        used:    Number(r.used),
        revoked: Number(r.revoked),
        expired: Number(r.expired),
        demo:    Number(r.demo),
    }
}

/**
 * Valida una chispa. Si se pasa userId, la marca como usada.
 */
export async function validateChispa(code, userId = null) {
    const normalized = code?.toUpperCase().trim()
    const chispa     = await getChispa(normalized)

    if (!chispa)          return { valid: false, reason: 'INVALID_CODE' }
    if (chispa.revoked)   return { valid: false, reason: 'REVOKED' }
    if (chispa.used)      return { valid: false, reason: 'ALREADY_USED' }
    if (chispa.expiresAt && new Date(chispa.expiresAt) < new Date()) {
        return { valid: false, reason: 'EXPIRED' }
    }

    if (userId) {
        await query(
            `UPDATE chispas SET used = TRUE, used_at = NOW(), used_by = $2 WHERE code = $1`,
            [normalized, userId]
        )
    }

    return { valid: true, record: chispa }
}

/**
 * Revoca una chispa permanentemente.
 */
export async function revokeChispa(code) {
    const { rows } = await query(
        `UPDATE chispas SET revoked = TRUE WHERE code = $1 RETURNING code`,
        [code?.toUpperCase().trim()]
    )
    return rows.length > 0
}

// ── Canje ligado al usuario ─────────────────────────────────────────────────────

/**
 * Canjea (consume) una chispa a nombre de un usuario con sesión.
 * · No se puede recanjear (used = TRUE la bloquea).
 * · Si la chispa tiene dueño asignado, solo ese usuario puede canjearla.
 * Marca used = TRUE, used_at = NOW(), used_by = email.
 *
 * @returns {{ ok: boolean, reason?: string, record?: object }}
 */
export async function canjearChispa(code, usuarioEmail) {
    const normalized = code?.toUpperCase().trim()
    const chispa     = await getChispa(normalized)

    if (!chispa)        return { ok: false, reason: 'INVALID_CODE' }
    if (chispa.revoked) return { ok: false, reason: 'REVOKED' }
    if (chispa.used)    return { ok: false, reason: 'ALREADY_USED' }
    if (chispa.expiresAt && new Date(chispa.expiresAt) < new Date()) {
        return { ok: false, reason: 'EXPIRED' }
    }
    // La chispa se crea para un usuario específico: solo ese puede canjearla.
    if (chispa.usuarioEmail &&
        chispa.usuarioEmail.toLowerCase() !== usuarioEmail.toLowerCase()) {
        return { ok: false, reason: 'NOT_OWNER' }
    }

    await query(
        `UPDATE chispas SET used = TRUE, used_at = NOW(), used_by = $2 WHERE code = $1`,
        [normalized, usuarioEmail.toLowerCase().trim()]
    )
    return { ok: true, record: await getChispa(normalized) }
}

// ── Talleres desbloqueados del usuario (con estado calculado) ───────────────────

const UN_DIA_MS = 86_400_000
const MATERIAL_DIAS = 30

/** Fecha (medianoche) desde un DATE/ISO, o null. */
function soloFecha(v) {
    if (!v) return null
    const d = new Date(v)
    if (isNaN(d)) return null
    d.setHours(0, 0, 0, 0)
    return d
}

// Offset fijo de CDMX: UTC−6 (México ya no usa horario de verano desde 2022).
const TZ_CDMX = '-06:00'
const MARGEN_CLASE_MS = 30 * 60 * 1000 // 30 min antes

/**
 * Calcula el estado de un taller y de su material para el frontend.
 * Reglas:
 *   · El material (apoyo + modelos 3D) se libera al CONCLUIR el taller
 *     (fecha_fin, o fecha_inicio si no hay fin) y vive 30 días contados
 *     DESDE EL DÍA SIGUIENTE a la conclusión.
 *   · La clase es accesible el día del taller. Si hay hora_inicio, se valida
 *     con precisión en UTC (desde 30 min antes hasta el fin del día del taller,
 *     hora CDMX). Sin hora_inicio, se valida a nivel de día.
 */
function estadoTaller({ fecha_inicio, fecha_fin, hora_inicio, hora_fin }) {
    const hoy    = soloFecha(new Date())
    const inicio = soloFecha(fecha_inicio)
    const fin    = soloFecha(fecha_fin) || inicio
    const concluye = fin

    let fase = 'sin_fecha'
    let claseAccesibleHoy = false
    const material = { estado: 'no_disponible', disponible: false, diasRestantes: 0, vence: null }

    if (inicio) {
        if (hoy < inicio)      fase = 'proximo'
        else if (hoy <= fin)   fase = 'en_curso'
        else                   fase = 'concluido'

        if (hora_inicio && fecha_inicio) {
            // Validación precisa en UTC usando la hora local CDMX.
            // Fin: hora_fin si existe, si no el final del día del taller.
            const finDia = fecha_fin || fecha_inicio
            const ahora  = Date.now()
            const start  = new Date(`${fecha_inicio}T${hora_inicio}${TZ_CDMX}`).getTime()
            const end    = hora_fin
                ? new Date(`${finDia}T${hora_fin}${TZ_CDMX}`).getTime()
                : new Date(`${finDia}T23:59:59${TZ_CDMX}`).getTime()
            claseAccesibleHoy = ahora >= (start - MARGEN_CLASE_MS) && ahora <= end
        } else {
            // Sin hora: acceso a nivel de día (hoy dentro del rango del taller).
            claseAccesibleHoy = hoy >= inicio && hoy <= fin
        }
    }

    if (concluye) {
        // Ventana: desde el día siguiente a concluir, por 30 días.
        const desde = new Date(concluye.getTime() + UN_DIA_MS)
        const hasta = new Date(concluye.getTime() + MATERIAL_DIAS * UN_DIA_MS)
        material.vence = hasta.toISOString().slice(0, 10)
        if (hoy < desde) {
            material.estado = 'no_disponible'         // el taller aún no concluye
        } else if (hoy <= hasta) {
            material.estado = 'disponible'
            material.disponible = true
            material.diasRestantes = Math.ceil((hasta.getTime() - hoy.getTime()) / UN_DIA_MS)
        } else {
            material.estado = 'expirado'
        }
    }

    return { fase, claseAccesibleHoy, material }
}

/**
 * Lista los talleres que el usuario tiene ASIGNADOS, con el estado calculado
 * de taller, clase y material.
 *
 * ── Qué hace que un taller se vea (reglas de negocio, 21 ago 2026) ──────────
 *
 * Se exigen TRES cosas. Antes bastaba con que la chispa no estuviera revocada,
 * y eso dejaba ver talleres que ya habían caducado o que nunca se pagaron.
 *
 * 1. La chispa NO está revocada.
 * 2. La chispa NO ha caducado. `expires_at` se guardaba pero nadie la miraba:
 *    había chispas vencidas hacía un mes que seguían dando acceso. `NULL` =
 *    sin vigencia, se queda para siempre.
 * 3. Hay una confirmación de que le toca:
 *      · un registro en `lista_espera` con estado 'pagado' para ese taller, O
 *      · que la chispa sea DEMO. En un regalo no hay pago que confirmar, así
 *        que el acto de Paola de crearla marcada como demo ES la confirmación.
 *        Sin esta excepción, toda demo que regalara quedaría invisible.
 *
 * NO se exige `used = TRUE`: ya no hay canje manual, la chispa se asigna y listo.
 *
 * `DISTINCT ON (t.id)` evita tarjetas duplicadas si tuviera más de una chispa
 * del mismo taller (p. ej. una demo y luego la compra): gana la más reciente.
 */
export async function getTalleresDelUsuario(email) {
    const { rows } = await query(
        `SELECT DISTINCT ON (t.id)
                c.code, c.used_at, c.created_at, c.expires_at, c.is_demo,
                t.id   AS taller_id, t.nombre, t.descripcion, t.categoria,
                t.horario, t.hora_inicio, t.hora_fin, t.fecha_inicio, t.fecha_fin, t.imagen_url
         FROM chispas c
         JOIN talleres t ON t.id = c.taller_id
         WHERE LOWER(c.usuario_email) = LOWER($1)
           AND c.revoked = FALSE
           AND (c.expires_at IS NULL OR c.expires_at > NOW())
           AND (
                 c.is_demo = TRUE
                 OR EXISTS (
                     SELECT 1 FROM lista_espera le
                     WHERE LOWER(le.email) = LOWER(c.usuario_email)
                       AND le.taller_id = c.taller_id
                       AND le.estado = 'pagado'
                 )
               )
         ORDER BY t.id, c.created_at DESC`,
        [email.trim()]
    )

    return rows
        .map((r) => ({
            code:        r.code,
            tallerId:    r.taller_id,
            nombre:      r.nombre,
            descripcion: r.descripcion,
            categoria:   r.categoria,
            horario:     r.horario,
            horaInicio:  r.hora_inicio,
            horaFin:     r.hora_fin,
            fechaInicio: r.fecha_inicio,
            fechaFin:    r.fecha_fin,
            imagenUrl:   r.imagen_url,
            esDemo:      r.is_demo,
            asignadaAt:  r.created_at,
            canjeadaAt:  r.used_at,
            ...estadoTaller(r),
        }))
        .sort((a, b) => String(b.fechaInicio ?? '').localeCompare(String(a.fechaInicio ?? '')))
}