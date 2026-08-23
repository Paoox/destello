/**
 * Destello — Asistencia real al aula
 *
 * Hasta la migración 009 la única señal de asistencia era la *declarada*: el
 * alumno respondía "sí voy" en un pop-up. Decir que vas no es haber ido, y con
 * esa señal no se puede certificar a nadie con honestidad.
 *
 * Esto registra la señal real: quién abrió su aula y **cuánto tiempo la tuvo
 * abierta**. El aula manda una entrada al abrirse y un latido cada pocos
 * minutos mientras siga abierta.
 *
 * ── Por qué latidos y no "entró / salió" ────────────────────────────────────
 * Nadie cierra sesión: cierran la pestaña, se les acaba la pila, se les cae el
 * internet. Un evento de salida que la mitad de las veces no llega produce
 * sesiones eternas. Con latidos, lo que ya se contó ya se contó, y si el
 * alumno desaparece simplemente deja de sumar.
 */

import { query } from '../db/db.js'
import { registrarEvento, EVENTO } from './eventoService.js'

/**
 * Cada cuánto late el aula. El front usa este mismo número.
 * Más corto = más preciso y más tráfico; más largo = al revés.
 */
export const LATIDO_MINUTOS = 2

/**
 * Hueco máximo que se cuenta como "seguía ahí".
 *
 * Si entre dos latidos pasó más que esto, la persona no estaba: se le fue el
 * internet, se durmió la compu, dejó la pestaña abierta toda la noche. Ese
 * tiempo NO se suma. Es el tope que evita el caso "dejó el aula abierta hasta
 * el otro día y salió con 14 horas de asistencia".
 */
const HUECO_MAXIMO_MINUTOS = LATIDO_MINUTOS * 3

/**
 * Después de este silencio, volver a entrar cuenta como una entrada nueva.
 * Sirve para distinguir un F5 (no es entrada nueva) de una reconexión real.
 */
const ENTRADA_NUEVA_MINUTOS = 20

/**
 * ¿Esta persona tiene derecho a estar en este taller?
 *
 * Se comprueba SIEMPRE, aunque el front ya lo haya comprobado: el front se
 * puede saltar. Sin esto, cualquiera con sesión podría fabricarse asistencia
 * a un taller que no compró — y de la asistencia sale el certificado.
 */
export async function tieneAcceso(email, tallerId) {
    const { rows } = await query(
        `SELECT 1
           FROM chispas c
          WHERE LOWER(c.usuario_email) = LOWER($1)
            AND c.taller_id = $2
            AND c.revoked = FALSE
            AND (c.expires_at IS NULL OR c.expires_at > NOW())
            AND ( c.is_demo = TRUE
                  OR EXISTS (SELECT 1 FROM lista_espera le
                              WHERE LOWER(le.email) = LOWER(c.usuario_email)
                                AND le.taller_id = c.taller_id
                                AND le.estado = 'pagado') )
          LIMIT 1`,
        [String(email).trim(), tallerId]
    )
    return rows.length > 0
}

/**
 * Registra que la persona está en el aula ahora mismo.
 *
 * Se llama igual al abrir el aula (`entrada = true`) que en cada latido. La
 * diferencia es solo si cuenta como una entrada nueva; el tiempo se acumula
 * igual en los dos casos.
 *
 * Devuelve el estado actualizado, o `null` si no tiene acceso.
 */
export async function registrarPresencia(email, tallerId, { entrada = false } = {}) {
    if (!(await tieneAcceso(email, tallerId))) return null

    const correo = String(email).trim().toLowerCase()

    // Todo en una sola sentencia para que dos latidos simultáneos (dos pestañas
    // abiertas) no se pisen: Postgres resuelve el conflicto, no la aplicación.
    //
    // EXTRACT(EPOCH ...)/60 = minutos desde el último latido. Solo se suman si
    // caben en el hueco máximo; si no, se asume que no estaba.
    const { rows } = await query(
        `INSERT INTO asistencias (usuario_email, taller_id, origen)
         VALUES ($1, $2, 'aula')
         ON CONFLICT (LOWER(usuario_email), taller_id) DO UPDATE
            SET minutos = asistencias.minutos + CASE
                    WHEN EXTRACT(EPOCH FROM (NOW() - asistencias.ultimo_latido)) / 60 <= $3
                    THEN ROUND(EXTRACT(EPOCH FROM (NOW() - asistencias.ultimo_latido)) / 60)
                    ELSE 0
                END,
                entradas = asistencias.entradas + CASE
                    WHEN $4::boolean
                     AND EXTRACT(EPOCH FROM (NOW() - asistencias.ultimo_latido)) / 60 > $5
                    THEN 1 ELSE 0
                END,
                ultimo_latido = NOW()
       RETURNING id, primera_entrada, ultimo_latido, entradas, minutos, (xmax = 0) AS es_nueva`,
        [correo, tallerId, HUECO_MAXIMO_MINUTOS, entrada === true, ENTRADA_NUEVA_MINUTOS]
    )

    const fila = rows[0]

    // `taller_abierto` estaba declarado en el catálogo de eventos desde la
    // migración 003 y nunca se había emitido. Se emite solo la primera vez y en
    // reconexiones reales: un latido cada dos minutos llenaría la tabla de
    // ruido sin decir nada nuevo.
    if (fila?.es_nueva || (entrada && fila?.entradas > 1)) {
        await registrarEvento({
            tipo:         EVENTO.TALLER_ABIERTO,
            usuarioEmail: correo,
            tallerId,
            origen:       'web',
            metadata:     { entradas: fila.entradas },
        })
    }

    return {
        primeraEntrada: fila.primera_entrada,
        ultimoLatido:   fila.ultimo_latido,
        entradas:       fila.entradas,
        minutos:        fila.minutos,
    }
}

/** La lista que ve Paola después del taller: quién entró y cuánto tiempo. */
export async function asistenciaDeTaller(tallerId) {
    const { rows } = await query(
        `SELECT usuario_email, nombre, apellido, nombre_certificado,
                es_demo, asistencia_respuesta,
                primera_entrada, ultimo_latido, entradas, minutos, entro,
                asistencia_origen, certificado_folio, tiene_certificado
           FROM v_asistencia_taller
          WHERE taller_id = $1
          ORDER BY minutos DESC, usuario_email`,
        [tallerId]
    )
    return rows
}

/**
 * Alta manual desde el panel.
 *
 * Existe porque la realidad no cabe en el registro automático: se le fue el
 * internet, entró desde el celular de su hermana, llegó tarde. `nota` guarda el
 * porqué — sin eso, dentro de tres meses nadie sabe por qué esta persona tiene
 * asistencia sin haber abierto el aula.
 */
export async function agregarManual(email, tallerId, { minutos = 0, actor, nota } = {}) {
    const correo = String(email).trim().toLowerCase()
    const { rows } = await query(
        `INSERT INTO asistencias (usuario_email, taller_id, minutos, origen, nota)
         VALUES ($1, $2, $3, 'admin', $4)
         ON CONFLICT (LOWER(usuario_email), taller_id) DO UPDATE
            SET minutos = GREATEST(asistencias.minutos, EXCLUDED.minutos),
                origen  = 'admin',
                nota    = COALESCE(EXCLUDED.nota, asistencias.nota)
       RETURNING id, usuario_email, minutos, entradas`,
        [correo, tallerId, Math.max(0, Number(minutos) || 0),
         nota ? `${nota}${actor ? ` (${actor})` : ''}` : null]
    )
    return rows[0]
}
