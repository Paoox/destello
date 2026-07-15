/**
 * Destello API — Referral Service (Estrellas y Supernovas)
 *
 * · Cada usuario tiene un codigo_referido (su "polvo estelar") para compartir.
 * · Cuando un usuario NUEVO se registra con un código de invitado, se registra
 *   el referido en el libro mayor (tabla `referidos`) y se acreditan Estrellas
 *   al referidor (usuarios.estrellas, saldo cacheado).
 * · Las Estrellas se canjean por Supernovas (catálogo).
 */
import crypto    from 'node:crypto'
import { query } from '../db/db.js'

// Estrellas que gana el referidor por cada amigo que entra con su código.
export const ESTRELLAS_POR_REFERIDO = 50

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

/**
 * Registra un referido: liga al usuario nuevo con quien lo invitó y acredita
 * Estrellas al referidor. Idempotente: un usuario solo puede ser referido 1 vez.
 * @returns {{ credited: boolean, reason?: string, estrellas?: number }}
 */
export async function registrarReferido(codigoInvitado, nuevoEmail) {
    const code = codigoInvitado?.trim().toUpperCase()
    if (!code) return { credited: false, reason: 'NO_CODE' }

    const { rows } = await query(
        'SELECT email FROM usuarios WHERE UPPER(codigo_referido) = $1',
        [code]
    )
    const referidor = rows[0]
    if (!referidor) return { credited: false, reason: 'CODE_NOT_FOUND' }
    if (referidor.email.toLowerCase() === nuevoEmail.toLowerCase()) {
        return { credited: false, reason: 'SELF' }
    }

    // ¿Este usuario ya fue referido antes?
    const { rows: ya } = await query(
        'SELECT 1 FROM referidos WHERE LOWER(referido_email) = LOWER($1)',
        [nuevoEmail]
    )
    if (ya.length) return { credited: false, reason: 'ALREADY_REFERRED' }

    // Libro mayor + vínculo + saldo cacheado del referidor.
    await query(
        `INSERT INTO referidos (referidor_email, referido_email, codigo_usado, estrellas)
         VALUES ($1, $2, $3, $4)`,
        [referidor.email, nuevoEmail.toLowerCase(), code, ESTRELLAS_POR_REFERIDO]
    )
    await query(
        'UPDATE usuarios SET referido_por = $2 WHERE LOWER(email) = LOWER($1)',
        [nuevoEmail, referidor.email]
    )
    await query(
        'UPDATE usuarios SET estrellas = COALESCE(estrellas, 0) + $2 WHERE email = $1',
        [referidor.email, ESTRELLAS_POR_REFERIDO]
    )

    return { credited: true, estrellas: ESTRELLAS_POR_REFERIDO }
}

// ── Supernovas ──────────────────────────────────────────────────────────────────

/** Catálogo de Supernovas activas (premios canjeables con Estrellas). */
export async function listSupernovas() {
    const { rows } = await query(
        `SELECT id, nombre, descripcion, costo_estrellas
         FROM supernovas
         WHERE activo = TRUE
         ORDER BY costo_estrellas ASC`
    )
    return rows
}

/**
 * Canjea una Supernova: valida saldo, registra el canje y descuenta Estrellas.
 * @returns {{ ok: boolean, reason?: string, restante?: number }}
 */
export async function canjearSupernova(supernovaId, usuarioEmail) {
    const { rows: sn } = await query(
        'SELECT id, nombre, costo_estrellas FROM supernovas WHERE id = $1 AND activo = TRUE',
        [supernovaId]
    )
    const supernova = sn[0]
    if (!supernova) return { ok: false, reason: 'NOT_FOUND' }

    const { rows: us } = await query(
        'SELECT estrellas FROM usuarios WHERE LOWER(email) = LOWER($1)',
        [usuarioEmail]
    )
    const saldo = Number(us[0]?.estrellas ?? 0)
    if (saldo < supernova.costo_estrellas) {
        return { ok: false, reason: 'INSUFFICIENT', restante: saldo }
    }

    await query(
        `INSERT INTO canjes_supernova (usuario_email, supernova_id, estrellas_gastadas)
         VALUES ($1, $2, $3)`,
        [usuarioEmail.toLowerCase(), supernova.id, supernova.costo_estrellas]
    )
    const { rows: upd } = await query(
        'UPDATE usuarios SET estrellas = estrellas - $2 WHERE LOWER(email) = LOWER($1) RETURNING estrellas',
        [usuarioEmail, supernova.costo_estrellas]
    )
    return { ok: true, restante: Number(upd[0]?.estrellas ?? 0), supernova: supernova.nombre }
}
