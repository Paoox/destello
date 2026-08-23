/**
 * Destello API — Bitácora de eventos
 *
 * Un renglón por cada cosa que pasa en la plataforma. La tabla `eventos` es
 * append-only: nunca se hace UPDATE ni DELETE sobre ella.
 *
 * ── Por qué una tabla genérica en vez de columnas por métrica ───────────────
 *
 * Cada métrica nueva que se quiera medir con columnas fijas implica migrar la
 * BD otra vez. Con una bitácora y un `metadata` JSONB se pueden contestar
 * preguntas que hoy todavía no se te ocurren, sin tocar el esquema.
 *
 * Y no es solo para el dashboard: es la memoria que van a leer los agentes
 * cuando empiecen a tomar las decisiones que hoy toma Paola a mano. Por eso
 * importa guardar el CONTEXTO de cada evento, no nada más que ocurrió.
 *
 * ── Regla de oro: registrar un evento NUNCA debe romper el flujo ────────────
 *
 * Si la bitácora falla, se anota en consola y la vida sigue. Que no se pueda
 * medir algo es un problema; que un alumno no pueda inscribirse porque la
 * bitácora estaba caída sería mucho peor.
 */

import { query } from '../db/db.js'

/**
 * Tipos de evento en uso. No es una restricción de la BD (la columna es TEXT
 * a propósito, para no tener que migrar cada vez que aparezca uno nuevo), pero
 * sí es la lista viva: agregar aquí lo que se vaya usando.
 */
export const EVENTO = {
    // Bot de WhatsApp
    BOT_CONVERSACION_INICIO: 'bot_conversacion_inicio',
    BOT_MENU_OPCION:         'bot_menu_opcion',
    BOT_REGISTRO_COMPLETO:   'bot_registro_completo',
    BOT_CONVERSACION_FIN:    'bot_conversacion_fin',
    // Acceso
    LOGIN:                   'login',
    LOGIN_FALLIDO:           'login_fallido',
    // Contenido
    TALLER_ABIERTO:          'taller_abierto',
    // Los demás (lista_espera_*, usuario_activado, taller_asignado,
    // chispa_revocada, pago_*) los generan solos los triggers de la
    // migración 003 — no hay que escribirlos desde el código.
}

/**
 * Registra un evento. Nunca lanza excepción.
 *
 * @param {object} e
 * @param {string} e.tipo          ver EVENTO
 * @param {string} [e.usuarioEmail]
 * @param {string} [e.tallerId]
 * @param {string} [e.origen]      bot | web | admin | sistema
 * @param {string} [e.actor]       quién lo provocó
 * @param {object} [e.metadata]    contexto libre (JSONB)
 */
export async function registrarEvento({
    tipo, usuarioEmail = null, tallerId = null,
    origen = null, actor = null, metadata = {},
} = {}) {
    if (!tipo) return null
    try {
        const { rows } = await query(
            `INSERT INTO eventos (tipo, usuario_email, taller_id, origen, actor, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb)
             RETURNING id`,
            [
                tipo,
                usuarioEmail ? String(usuarioEmail).toLowerCase().trim() : null,
                tallerId,
                origen,
                actor,
                JSON.stringify(metadata ?? {}),
            ]
        )
        return rows[0]?.id ?? null
    } catch (err) {
        console.error('[eventos] No se pudo registrar', tipo, '—', err.message)
        return null
    }
}

/**
 * Marca que alguien entró: primer_login_at, ultimo_login_at, total_logins y
 * método. También deja el evento en la bitácora.
 *
 * `primer_login_at` es la columna más valiosa del embudo: la diferencia entre
 * cuentas activas y gente que de verdad entró son las personas que pagaron y
 * nunca usaron la plataforma. Sin esto, ese hueco es invisible.
 *
 * Nunca lanza: que falle la medición no debe tumbar un login que ya es válido.
 */
export async function registrarLogin(email, metodo = 'desconocido') {
    if (!email) return
    const emailNorm = String(email).toLowerCase().trim()
    try {
        await query(
            `UPDATE usuarios
                SET primer_login_at = COALESCE(primer_login_at, NOW()),
                    ultimo_login_at = NOW(),
                    total_logins    = COALESCE(total_logins, 0) + 1,
                    metodo_login    = $2
              WHERE LOWER(email) = $1`,
            [emailNorm, metodo]
        )
    } catch (err) {
        console.error('[eventos] No se pudo marcar el login:', err.message)
    }
    await registrarEvento({
        tipo:         EVENTO.LOGIN,
        usuarioEmail: emailNorm,
        origen:       'web',
        metadata:     { metodo },
    })
}
