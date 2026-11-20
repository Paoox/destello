/**
 * Destello API — Referral Service (Estrellas y Supernovas)
 *
 * · Cada usuario tiene un codigo_referido (su "polvo estelar") para compartir.
 * · La persona invitada escribe ese código al inscribirse (web) o en su
 *   Perfil → queda en `referidos`.
 * · Cuando la invitada PAGA su taller, quien invitó gana Supernovas, y cada
 *   5 invitadas que pagaron, un cupón de 30% (migración 028).
 */
import crypto    from 'node:crypto'
import { query } from '../db/db.js'
import { acreditarReferido } from './habitatService.js'
import { SUPERNOVAS_POR_REFERIDO } from './habitatCatalogo.js'
import { SQL_ES_CORTESIA } from './conteoAlumnos.js'


/** Base del código a partir del nombre (hasta 6 letras/números, sin acentos). */
function baseNombre(nombre) {
    const base = (nombre || 'DEST')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 6)
    return base || 'DEST'
}

/** Genera un código de referido único, ej. PAOLA-9F2A. */
async function codigoUnico(nombre) {
    for (let i = 0; i < 12; i++) {
        const code = `${baseNombre(nombre)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
        const { rows } = await query('SELECT 1 FROM usuarios WHERE codigo_referido = $1', [code])
        if (rows.length === 0) return code
    }
    throw new Error('No se pudo generar un código de referido único')
}

/** Devuelve el codigo_referido del usuario; lo genera y guarda si no tiene. */
export async function ensureCodigoReferido(userId) {
    const { rows } = await query(
        'SELECT id, nombre, codigo_referido FROM usuarios WHERE id = $1',
        [userId]
    )
    const u = rows[0]
    if (!u) return null
    if (u.codigo_referido) return u.codigo_referido

    const code = await codigoUnico(u.nombre)
    await query('UPDATE usuarios SET codigo_referido = $2 WHERE id = $1', [userId, code])
    return code
}

export const REFERIDOS_POR_CUPON = 5
export const CUPON_PORCENTAJE    = 30
export const CUPON_MESES         = 6

/** Motivos por los que un código no se puede usar, en palabras de la persona. */
export const MOTIVO_REFERIDO = {
    NO_CODE:          'Escribe el código de quien te invitó',
    CODE_NOT_FOUND:   'No encontramos ese código. Revísalo con quien te invitó',
    SELF:             'Ese es tu propio código 😊',
    ALREADY_REFERRED: 'Ya tienes registrado a quien te invitó',
    CICLO:            'Esa persona entró con tu código, no puede ser al revés',
}

/**
 * Liga a una persona con quien la invitó (19 nov 2026: YA NO acredita al
 * registrarse — las Supernovas llegan cuando la persona invitada paga su
 * taller, ver `recompensarReferido`). Una persona solo se liga una vez.
 * @returns {{ ok: boolean, reason?: string, referidorEmail?: string }}
 */
export async function registrarReferido(codigoInvitado, nuevoEmail, q = query) {
    const code = codigoInvitado?.trim().toUpperCase()
    if (!code) return { ok: false, reason: 'NO_CODE' }
    const email = String(nuevoEmail ?? '').toLowerCase().trim()

    const { rows } = await q(
        'SELECT email, referido_por FROM usuarios WHERE UPPER(codigo_referido) = $1', [code])
    const referidor = rows[0]
    if (!referidor) return { ok: false, reason: 'CODE_NOT_FOUND' }
    if (referidor.email.toLowerCase() === email) return { ok: false, reason: 'SELF' }
    if (String(referidor.referido_por ?? '').toLowerCase() === email) return { ok: false, reason: 'CICLO' }

    const { rows: ya } = await q('SELECT 1 FROM referidos WHERE LOWER(referido_email) = $1', [email])
    if (ya.length) return { ok: false, reason: 'ALREADY_REFERRED' }

    await q(
        `INSERT INTO referidos (referidor_email, referido_email, codigo_usado, estrellas)
         VALUES ($1, $2, $3, $4)`,
        [referidor.email, email, code, SUPERNOVAS_POR_REFERIDO])
    await q('UPDATE usuarios SET referido_por = $2 WHERE LOWER(email) = $1', [email, referidor.email])
    return { ok: true, referidorEmail: referidor.email }
}

/** Al llegar a N referidos que pagaron, ¿toca cupón? (pura: cada 5) */
export const tocaCupon = (pagados) => pagados > 0 && pagados % REFERIDOS_POR_CUPON === 0

/**
 * Si la persona fue invitada por alguien y YA pagó un taller (sin
 * cortesías), le da a quien la invitó sus Supernovas y, cada 5, un cupón.
 * Idempotente: se puede llamar cuantas veces sea. Se llama al confirmar un
 * pago (dentro de la transacción) y al capturar el código en el Perfil.
 * @returns {null | { referidorId, referidoNombre, supernovas, pagados, cupon }}
 */
export async function recompensarReferido(referidoEmail, q = query) {
    const email = String(referidoEmail ?? '').toLowerCase().trim()
    const { rows: [ref] } = await q(
        `SELECT r.id, r.referidor_email, u.id AS referidor_id, ref.nombre AS referido_nombre
           FROM referidos r
           JOIN usuarios u ON LOWER(u.email) = LOWER(r.referidor_email)
           LEFT JOIN usuarios ref ON LOWER(ref.email) = LOWER(r.referido_email)
          WHERE LOWER(r.referido_email) = $1 AND r.recompensado_at IS NULL
          FOR UPDATE OF r`, [email])
    if (!ref) return null

    const { rows: pago } = await q(
        `SELECT 1 FROM lista_espera le
          WHERE LOWER(le.email) = $1 AND le.pagado_at IS NOT NULL
            AND NOT ${SQL_ES_CORTESIA('le.id')}
          LIMIT 1`, [email])
    if (!pago.length) return null

    await q('UPDATE referidos SET recompensado_at = NOW() WHERE id = $1', [ref.id])
    await acreditarReferido(ref.referidor_id, email, q)

    const { rows: [{ n }] } = await q(
        `SELECT COUNT(*)::int AS n FROM referidos
          WHERE LOWER(referidor_email) = LOWER($1) AND recompensado_at IS NOT NULL`, [ref.referidor_email])
    let cupon = null
    if (tocaCupon(n)) {
        const codigo = `CUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
        const { rows } = await q(
            `INSERT INTO cupones (usuario_id, codigo, porcentaje, motivo, ref, vence_at)
             VALUES ($1, $2, $3, 'referidos', $4, NOW() + ($5 || ' months')::interval)
             ON CONFLICT (usuario_id, motivo, ref) DO NOTHING
             RETURNING codigo, porcentaje, to_char(vence_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') AS vence`,
            [ref.referidor_id, codigo, CUPON_PORCENTAJE, `referidos-${n}`, String(CUPON_MESES)])
        cupon = rows[0] ?? null
    }
    return { referidorId: ref.referidor_id, referidoNombre: ref.referido_nombre, supernovas: SUPERNOVAS_POR_REFERIDO, pagados: n, cupon }
}

/** Avisa a quien invitó (después de la transacción: notificarAhora no va dentro). */
export async function avisarRecompensa(r) {
    if (!r) return
    try {
        // Import tardío: notificacionService carga el correo (Resend) y no
        // hace falta para la lógica de referidos ni para sus pruebas.
        const { notificarAhora } = await import('./notificacionService.js')
        await notificarAhora(r.referidorId, 'referido_pago', `ref-${r.pagados}`, { supernovas: r.supernovas, invitado: r.referidoNombre })
        if (r.cupon) await notificarAhora(r.referidorId, 'cupon', r.cupon.codigo, { ...r.cupon, referidos: r.pagados })
    } catch (err) {
        console.warn('[referidos] no se pudo avisar:', err.message)
    }
}

/** Cupón vigente sin usar (el más viejo primero: se gasta el que vence antes). */
export async function cuponVigente(usuarioId, q = query) {
    const { rows } = await q(
        `SELECT id, codigo, porcentaje, vence_at FROM cupones
          WHERE usuario_id = $1 AND usado_at IS NULL AND vence_at > NOW()
          ORDER BY vence_at LIMIT 1`, [usuarioId])
    return rows[0] ?? null
}

/** Para el Perfil: mi código, quién me invitó, mi avance al cupón y mis cupones. */
export async function resumenReferidos(usuarioId) {
    const codigo = await ensureCodigoReferido(usuarioId)
    const { rows: [u] } = await query(
        `SELECT u.email, inv.nombre AS invito_nombre, inv.apellido AS invito_apellido
           FROM usuarios u LEFT JOIN usuarios inv ON LOWER(inv.email) = LOWER(u.referido_por)
          WHERE u.id = $1`, [usuarioId])
    const { rows: [c] } = await query(
        `SELECT COUNT(*) FILTER (WHERE recompensado_at IS NOT NULL)::int AS pagaron,
                COUNT(*) FILTER (WHERE recompensado_at IS NULL)::int     AS sin_pagar
           FROM referidos WHERE LOWER(referidor_email) = LOWER($1)`, [u.email])
    const { rows: cupones } = await query(
        `SELECT codigo, porcentaje, to_char(vence_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD') AS vence,
                usado_at IS NOT NULL AS usado, vence_at < NOW() AS vencido
           FROM cupones WHERE usuario_id = $1 ORDER BY created_at DESC`, [usuarioId])
    const invito = [u.invito_nombre, String(u.invito_apellido ?? '').trim().split(/\s+/)[0]].filter(Boolean).join(' ')
    return {
        codigo,
        invitadoPor: u.invito_nombre || u.invito_apellido ? invito : null,
        pagaron: c.pagaron, sinPagar: c.sin_pagar,
        faltanParaCupon: REFERIDOS_POR_CUPON - (c.pagaron % REFERIDOS_POR_CUPON),
        reglas: { supernovas: SUPERNOVAS_POR_REFERIDO, cada: REFERIDOS_POR_CUPON, porcentaje: CUPON_PORCENTAJE, meses: CUPON_MESES },
        cupones,
    }
}

// ── Supernovas ──────────────────────────────────────────────────────────────────

/**
 * Catálogo viejo de premios (tabla `supernovas`). Desde el 19 nov 2026 las
 * Supernovas son la moneda y se gastan en el Hábitat; esto queda solo como
 * lectura para no romper GET /supernovas. El canje con Estrellas se retiró.
 */
export async function listSupernovas() {
    const { rows } = await query(
        `SELECT id, nombre, descripcion, costo_estrellas
         FROM supernovas
         WHERE activo = TRUE
         ORDER BY costo_estrellas ASC`
    )
    return rows
}
