/**
 * Destello API — Bloqueo de usuarios
 *
 * Dos interruptores independientes por cuenta, ambos reversibles:
 *
 *   · acceso   → no puede entrar a la plataforma (ni por web ni por el bot)
 *   · compras  → puede entrar y usar lo que ya tiene, pero no puede apartar
 *                lugar en nada nuevo
 *
 * NADA se borra nunca. Bloquear es poner un TRUE; desbloquear es ponerlo en
 * FALSE. Cada movimiento deja renglón en `usuarios_bloqueos` con su motivo.
 *
 * ── Por qué hay caché ────────────────────────────────────────────────────────
 *
 * El bloqueo tiene que revisarse en CADA petición autenticada, porque un JWT
 * ya emitido dura 7 días: sin eso, bloquear a alguien con la sesión abierta no
 * haría nada durante una semana entera. Pero una consulta a Supabase por cada
 * petición, desde la Toshiba y a través del túnel, es justo el tipo de peso
 * que este proyecto no se puede permitir.
 *
 * La solución es un caché en memoria de 60 segundos. El costo de esos 60 s se
 * paga solo en el peor caso (alguien recién bloqueado alcanza a hacer una
 * petición más), y `olvidar()` lo borra en el momento del bloqueo, así que en
 * la práctica el efecto es inmediato. Se reinicia con el proceso, que es lo
 * correcto: la verdad vive en la base, esto es solo una copia con fecha de
 * caducidad.
 */
import { query } from '../db/db.js'

const TTL_MS = 60_000
const cache  = new Map()   // email en minúsculas → { valor, hasta }

/** Borra del caché a una persona. Se llama al bloquear y al desbloquear. */
export function olvidar(email) {
    if (email) cache.delete(String(email).toLowerCase().trim())
}

/**
 * Estado de bloqueo de una cuenta, por correo.
 * Devuelve siempre un objeto — si el correo no existe, todo en FALSE: no
 * inventamos bloqueos para cuentas que no están.
 */
export async function estadoDe(email) {
    if (!email) return { acceso: false, compras: false, motivo: null }
    const key   = String(email).toLowerCase().trim()
    const cached = cache.get(key)
    if (cached && cached.hasta > Date.now()) return cached.valor

    const { rows } = await query(
        `SELECT acceso_bloqueado, compras_bloqueadas, bloqueo_motivo
           FROM usuarios WHERE LOWER(email) = $1`,
        [key]
    )
    const valor = {
        acceso:  rows[0]?.acceso_bloqueado   === true,
        compras: rows[0]?.compras_bloqueadas === true,
        motivo:  rows[0]?.bloqueo_motivo ?? null,
    }
    cache.set(key, { valor, hasta: Date.now() + TTL_MS })
    return valor
}

/** Igual que estadoDe pero por id — lo que trae el JWT. */
export async function estadoDePorId(userId) {
    const { rows } = await query('SELECT email FROM usuarios WHERE id = $1', [userId])
    return estadoDe(rows[0]?.email)
}

/**
 * El mensaje que ve la persona bloqueada.
 *
 * Decisión de Paola (24 ago 2026): decirle la verdad y darle por dónde
 * reclamar, en vez de un "correo o contraseña incorrectos". Un error genérico
 * protege un poco más contra quien defrauda a propósito, pero deja a ciegas a
 * quien fue bloqueado por error — y ese caso va a existir.
 */
export const MENSAJE_ACCESO =
    'Tu cuenta está temporalmente suspendida. Escríbenos por WhatsApp para aclararlo.'

export const MENSAJE_COMPRAS =
    'Por ahora no podemos apartarte lugar en talleres nuevos. ' +
    'Escríbenos por WhatsApp y lo revisamos contigo.'

/**
 * Mueve uno de los dos interruptores y deja constancia.
 *
 * @param {string}  email    a quién
 * @param {string}  tipo     'acceso' | 'compras'
 * @param {boolean} bloquear TRUE bloquea, FALSE desbloquea
 * @param {string}  motivo   por qué (obligatorio al bloquear)
 * @param {string}  hechoPor quién lo hizo — hoy siempre 'admin'
 */
export async function cambiar({ email, tipo, bloquear, motivo = null, hechoPor = 'admin' }) {
    if (!['acceso', 'compras'].includes(tipo)) {
        return { ok: false, reason: 'TIPO_INVALIDO' }
    }
    // Bloquear sin motivo es lo que convierte esto en algo indefendible tres
    // meses después. Desbloquear sí puede ir sin explicación.
    const motivoLimpio = motivo ? String(motivo).trim() : ''
    if (bloquear && motivoLimpio.length < 3) {
        return { ok: false, reason: 'MOTIVO_REQUERIDO' }
    }

    const columna = tipo === 'acceso' ? 'acceso_bloqueado' : 'compras_bloqueadas'

    // El motivo y la firma solo se escriben al bloquear. Al desbloquear se
    // limpian: dejar el motivo viejo colgado haría ver como bloqueada, en el
    // panel, a una cuenta que ya no lo está. El histórico queda en la bitácora.
    const { rows } = await query(
        `UPDATE usuarios
            SET ${columna}      = $2,
                bloqueo_motivo  = CASE WHEN $2 THEN $3   ELSE NULL END,
                bloqueo_at      = CASE WHEN $2 THEN NOW() ELSE NULL END,
                bloqueo_por     = CASE WHEN $2 THEN $4   ELSE NULL END,
                updated_at      = NOW()
          WHERE LOWER(email) = LOWER($1)
      RETURNING id, email, nombre, acceso_bloqueado, compras_bloqueadas,
                bloqueo_motivo, bloqueo_at, bloqueo_por`,
        [email, bloquear, motivoLimpio || null, hechoPor]
    )
    if (!rows.length) return { ok: false, reason: 'USER_NOT_FOUND' }

    await query(
        `INSERT INTO usuarios_bloqueos (usuario_email, tipo, bloqueado, motivo, hecho_por)
         VALUES (LOWER($1), $2, $3, $4, $5)`,
        [email, tipo, bloquear, motivoLimpio || null, hechoPor]
    )

    olvidar(email)
    return { ok: true, usuario: rows[0] }
}

/** Historial completo de una cuenta, del movimiento más reciente al más viejo. */
export async function historialDe(email) {
    const { rows } = await query(
        `SELECT id, tipo, bloqueado, motivo, hecho_por, created_at
           FROM usuarios_bloqueos
          WHERE LOWER(usuario_email) = LOWER($1)
          ORDER BY created_at DESC`,
        [email]
    )
    return rows
}

/**
 * Lista para la pestaña Usuarios.
 * `filtro`: 'todos' | 'bloqueados' | 'activos'. `busca`: texto libre sobre
 * nombre, correo o WhatsApp.
 */
export async function listar({ filtro = 'todos', busca = '', limite = 300 } = {}) {
    const where = []
    const vals  = []
    let i = 1

    if (filtro === 'bloqueados') {
        where.push('(acceso_bloqueado = TRUE OR compras_bloqueadas = TRUE)')
    } else if (filtro === 'activos') {
        where.push('acceso_bloqueado = FALSE AND compras_bloqueadas = FALSE')
    }

    const q = String(busca || '').trim()
    if (q) {
        // Un solo parámetro para los tres campos: así "ana" encuentra tanto a
        // Ana como a ana@correo.com sin que el panel tenga que adivinar qué
        // tecleó Paola.
        where.push(`(email ILIKE $${i} OR COALESCE(nombre,'') ILIKE $${i}
                     OR COALESCE(apellido,'') ILIKE $${i} OR COALESCE(whatsapp,'') ILIKE $${i})`)
        vals.push(`%${q}%`)
        i++
    }

    vals.push(Math.min(Number(limite) || 300, 1000))
    const { rows } = await query(
        `SELECT * FROM v_usuarios_admin
         ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
         ORDER BY (acceso_bloqueado OR compras_bloqueadas) DESC, created_at DESC
         LIMIT $${i}`,
        vals
    )
    return rows
}

/** Conteos para las tarjetas de arriba del panel. */
export async function stats() {
    const { rows } = await query(
        `SELECT COUNT(*)::int                                        AS total,
                COUNT(*) FILTER (WHERE acceso_bloqueado)::int        AS acceso_bloqueado,
                COUNT(*) FILTER (WHERE compras_bloqueadas)::int      AS compras_bloqueadas,
                COUNT(*) FILTER (WHERE estado = 'activo')::int       AS activos
           FROM usuarios`
    )
    return rows[0]
}
