/**
 * Destello API — Diagnóstico de acceso
 *
 * Reúne en una sola consulta todo lo que el bot necesita para saber por qué
 * alguien no puede entrar.
 *
 * SEÑAL ÚNICA: `usuarios.estado`.
 *   'activo' → Paola ya le dio permiso de entrar
 *   'espera' → está en lista, todavía sin permiso
 *
 * Los resplandores y chispas NO se consultan para decidir: son registros
 * internos. El usuario nunca recibe un código — entra con Google o con su
 * número + OTP (ver docs/flujo-acceso-bot.md).
 */
import { query } from '../db/db.js'
import { findByEmail } from './usuarioService.js'
import { getListasPorEmail } from './listaEsperaService.js'
import { getTalleresDelUsuario } from './chispaService.js'

/**
 * Foto completa del acceso de un email.
 */
export async function diagnosticar(email) {
    const emailNorm = String(email).toLowerCase().trim()
    const usuario   = await findByEmail(emailNorm)

    if (!usuario) {
        return { existe: false, activo: false, usuario: null, talleres: [], listas: [] }
    }

    const [listas, talleres] = await Promise.all([
        getListasPorEmail(emailNorm),
        getTalleresDelUsuario(emailNorm),
    ])

    return {
        existe:   true,
        activo:   usuario.estado === 'activo',
        usuario,
        talleres,
        listas,
        // Le falta el número → no podría entrar por WhatsApp OTP
        faltaWhatsapp: !usuario.whatsapp,
        // Lugar que Paola ya confirmó pero sigue sin pagarse
        cupoConfirmado: listas.find(l => l.estado === 'cupo_confirmado') || null,
        // Pagado en la lista pero el usuario NO está activo → estado inconsistente
        // (pasaba al marcar el estado con el selector, que no activaba al usuario)
        pagadoSinActivar: usuario.estado !== 'activo'
            ? listas.find(l => l.estado === 'pagado') || null
            : null,
    }
}

/**
 * Guarda el WhatsApp de alguien que ya tiene permiso pero no tiene el número
 * registrado. Sin este dato el login por número falla (phoneAuthController
 * busca por `whatsapp` + `estado = 'activo'`).
 *
 * Solo completa lo que falta: nunca pisa un número ya guardado.
 */
export async function completarWhatsapp(email, whatsapp) {
    const limpio = String(whatsapp || '').replace(/\D/g, '').slice(-10)
    if (limpio.length !== 10) return { actualizado: false, motivo: 'numero_invalido' }

    const { rows } = await query(
        `UPDATE usuarios
         SET whatsapp = $2, updated_at = NOW()
         WHERE LOWER(email) = LOWER($1)
           AND (whatsapp IS NULL OR whatsapp = '')
         RETURNING id, email, whatsapp`,
        [String(email).trim(), limpio]
    )

    return rows.length > 0
        ? { actualizado: true, usuario: rows[0] }
        : { actualizado: false, motivo: 'ya_tenia' }
}
