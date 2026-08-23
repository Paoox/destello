/**
 * Destello API — Users Routes
 * GET  /users/me        → perfil del usuario autenticado
 * PUT  /users/me        → actualizar perfil
 * GET  /users/me/progress → progreso en talleres
 */
import { Router } from 'express'
import { query } from '../db/db.js'
import * as chispaService from '../services/chispaService.js'
import * as referralService from '../services/referralService.js'
import * as usuarioService from '../services/usuarioService.js'
import { sincronizarEstadoCupo } from '../services/cupoService.js'
import { registrarEvento } from '../services/eventoService.js'
import * as asistenciaService from '../services/asistenciaService.js'
import * as certificadoService from '../services/certificadoService.js'

const router = Router()

/** Helper: obtiene el email del usuario autenticado a partir del userId del JWT. */
async function emailDelUsuario(userId) {
    const { rows } = await query('SELECT email FROM usuarios WHERE id = $1', [userId])
    return rows[0]?.email ?? null
}

// Perfil del usuario autenticado con datos reales de la BD
// (incluye estrellas y código de referido).
router.get('/me', async (req, res, next) => {
  try {
    // Genera código de referido (si falta) y registra la visita para la racha.
    await referralService.ensureCodigoReferido(req.user.userId)
    await usuarioService.registrarActividad(req.user.userId)

    const { rows } = await query(
      `SELECT id, email, nombre, apellido, whatsapp, estado,
              estrellas, racha, codigo_referido, referido_por
       FROM usuarios
       WHERE id = $1`,
      [req.user.userId]
    )
    const user = rows[0] ?? req.user
    // Logros = insignias otorgadas por la profesora (solo el conteo aquí).
    if (user.email) user.logros = await usuarioService.contarInsignias(user.email)

    res.json({ status: 'ok', user })
  } catch (err) {
    next(err)
  }
})

// Actualiza el perfil del usuario autenticado.
// Body admite: { nombre, apellido, whatsapp, nombreCertificado }.
// Solo actualiza lo que llega.
router.put('/me', async (req, res, next) => {
  try {
    const { nombre, apellido, whatsapp, nombreCertificado } = req.body

    const sets = []
    const vals = []
    let i = 1
    if (nombre   !== undefined) { sets.push(`nombre   = $${i++}`); vals.push(String(nombre).trim()) }
    if (apellido !== undefined) { sets.push(`apellido = $${i++}`); vals.push(String(apellido).trim()) }
    // El nombre del certificado se guarda aparte del de la cuenta a propósito:
    // hay quien se registra como "Ana" y quiere el papel a nombre de "Ana Ruiz
    // Méndez". La fecha la estampa la misma sentencia, para que no exista un
    // camino que guarde el nombre sin dejar constancia de cuándo lo dijo.
    if (nombreCertificado !== undefined) {
      const limpio = String(nombreCertificado).trim().replace(/\s+/g, ' ')
      if (limpio.length < 3) {
        return res.status(400).json({
          status:  'error',
          message: 'Escribe tu nombre como quieres que aparezca en el certificado',
        })
      }
      sets.push(`nombre_certificado = $${i++}`); vals.push(limpio)
      sets.push('nombre_certificado_at = NOW()')
    }
    if (whatsapp !== undefined) {
      // No dejar que alguien se apropie del número de otra cuenta editando su
      // perfil: sería la puerta trasera al mismo acceso cruzado del login.
      const waNorm = await usuarioService.asegurarWhatsappLibre(whatsapp, req.user.userId)
      sets.push(`whatsapp = $${i++}`); vals.push(waNorm)
    }

    if (!sets.length) return res.json({ status: 'ok', message: 'Nada que actualizar' })

    vals.push(req.user.userId)
    const { rows } = await query(
      `UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${i}
       RETURNING id, email, nombre, apellido, whatsapp, estado, nombre_certificado`,
      vals
    )
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

    res.json({ status: 'ok', user: rows[0] })
  } catch (err) {
    next(err)
  }
})

router.get('/me/progress', (req, res) => {
  // TODO: consultar progreso real desde DB
  res.json({
    status: 'ok',
    progress: [
      { tallerId: '1', completado: 65, ultimaClase: '2026-04-14' },
    ]
  })
})

// ── Talleres desbloqueados del usuario (chispas canjeadas) ──
// Devuelve cada taller con su estado (proximo/en_curso/concluido),
// si la clase es accesible hoy, y la ventana de material (30 días).
router.get('/me/talleres', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.json({ status: 'ok', talleres: [] })
    const talleres = await chispaService.getTalleresDelUsuario(email)
    res.json({ status: 'ok', talleres })
  } catch (err) {
    next(err)
  }
})

// ── Canjear una chispa a nombre del usuario con sesión ──
// Body: { code }. Marca la chispa como usada y la liga al usuario.
router.post('/me/canjear', async (req, res, next) => {
  try {
    const { code } = req.body
    if (!code) return res.status(400).json({ status: 'error', reason: 'BAD_REQUEST', message: 'Código requerido' })

    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', reason: 'USER_NOT_FOUND', message: 'Usuario no encontrado' })

    const result = await chispaService.canjearChispa(code, email)
    if (!result.ok) {
      const msg = {
        INVALID_CODE: 'Ese código no existe',
        REVOKED:      'Esa chispa fue revocada',
        ALREADY_USED: 'Esa chispa ya fue canjeada',
        EXPIRED:      'Esa chispa ya venció',
        NOT_OWNER:    'Esa chispa pertenece a otra cuenta',
      }[result.reason] ?? 'No se pudo canjear la chispa'
      return res.status(409).json({ status: 'error', reason: result.reason, message: msg })
    }

    res.json({ status: 'ok', chispa: result.record })
  } catch (err) {
    next(err)
  }
})

// ── Canjear una Supernova con Estrellas ──
// Body param en la URL: :id de la supernova. Descuenta Estrellas del saldo.
router.post('/me/supernovas/:id/canjear', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

    const result = await referralService.canjearSupernova(Number(req.params.id), email)
    if (!result.ok) {
      const msg = {
        NOT_FOUND:    'Esa Supernova no existe',
        INSUFFICIENT: 'No tienes suficientes Estrellas todavía',
      }[result.reason] ?? 'No se pudo canjear'
      return res.status(409).json({ status: 'error', reason: result.reason, message: msg, restante: result.restante })
    }
    res.json({ status: 'ok', restante: result.restante, supernova: result.supernova })
  } catch (err) {
    next(err)
  }
})

// ── Confirmación de asistencia ────────────────────────────────────────────
//
// Una cortesía ocupa una silla real en un taller en vivo. Si a quien la recibe
// no le avisamos ni le preguntamos, ese lugar se lo puede estar quitando a
// alguien que sí iría. Por eso, la primera vez que entra después de recibir su
// acceso, se le muestra el taller y se le pide un sí o un no.

/** GET /users/me/confirmar-asistencia → talleres que le faltan por confirmar */
router.get('/me/confirmar-asistencia', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.json({ status: 'ok', pendientes: [] })

    const { rows } = await query(
      `SELECT lista_espera_id, taller_id, taller_nombre, taller_descripcion,
              fecha_inicio, horario, is_demo, expires_at
         FROM v_falta_confirmar_asistencia
        WHERE LOWER(email) = LOWER($1)
        ORDER BY fecha_inicio NULLS LAST`,
      [email]
    )
    res.json({ status: 'ok', pendientes: rows })
  } catch (err) { next(err) }
})

/**
 * POST /users/me/confirmar-asistencia
 * Body: { listaEsperaId, asiste: true | false }
 *
 * Un "no" es tan valioso como un "sí": libera la silla a tiempo. Por eso se
 * guarda la respuesta y no solo el hecho de haber contestado.
 */
router.post('/me/confirmar-asistencia', async (req, res, next) => {
  try {
    const { listaEsperaId, asiste } = req.body ?? {}
    if (listaEsperaId == null) {
      return res.status(400).json({ status: 'error', message: 'listaEsperaId es requerido' })
    }

    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

    // El WHERE incluye el correo a propósito: sin eso, cualquiera con sesión
    // podría confirmar (o cancelar) la asistencia de otra persona mandando un
    // id distinto.
    const { rows } = await query(
      `UPDATE lista_espera
          SET asistencia_confirmada_at = NOW(),
              asistencia_respuesta     = $3
        WHERE id = $1 AND LOWER(email) = LOWER($2)
      RETURNING id, taller_id, asistencia_respuesta`,
      [listaEsperaId, email, asiste === false ? 'no' : 'si']
    )
    if (!rows.length) {
      return res.status(404).json({ status: 'error', message: 'Registro no encontrado' })
    }

    // Dijo que no va: se le revoca la chispa para que la silla vuelva a estar
    // disponible de inmediato. Es el punto de todo esto.
    if (asiste === false) {
      await query(
        `UPDATE chispas
            SET revoked = TRUE
          WHERE LOWER(usuario_email) = LOWER($1)
            AND taller_id = $2
            AND revoked = FALSE`,
        [email, rows[0].taller_id]
      )
      await query(`UPDATE lista_espera SET estado = 'rechazado' WHERE id = $1`, [listaEsperaId])
      await sincronizarEstadoCupo(rows[0].taller_id)
    }

    await registrarEvento({
      tipo:         asiste === false ? 'asistencia_cancelada' : 'asistencia_confirmada',
      usuarioEmail: email,
      tallerId:     rows[0].taller_id,
      origen:       'web',
      metadata:     { lista_espera_id: listaEsperaId },
    })

    res.json({ status: 'ok', registro: rows[0] })
  } catch (err) { next(err) }
})


// ══════════════════════════════════════════════════════════════════════════
//  Aula: asistencia real
// ══════════════════════════════════════════════════════════════════════════
//
// De aquí sale el certificado, así que el acceso se comprueba en el servidor
// en CADA llamada. El front ya lo comprueba, pero el front se puede saltar.

/**
 * POST /users/me/aula/:tallerId/presencia
 * Body: { entrada: true }  ← solo al abrir el aula; los latidos van sin body.
 *
 * El aula llama esto al abrirse y cada pocos minutos mientras siga abierta.
 * Devuelve `cadaMinutos` para que el front no tenga que codificar el ritmo:
 * si mañana cambia, cambia aquí y ya.
 */
router.post('/me/aula/:tallerId/presencia', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

    const estado = await asistenciaService.registrarPresencia(
      email, req.params.tallerId, { entrada: req.body?.entrada === true })

    if (!estado) {
      return res.status(403).json({ status: 'error', message: 'No tienes acceso a este taller' })
    }
    res.json({ status: 'ok', asistencia: estado,
               cadaMinutos: asistenciaService.LATIDO_MINUTOS })
  } catch (err) { next(err) }
})


// ══════════════════════════════════════════════════════════════════════════
//  Certificados del alumno
// ══════════════════════════════════════════════════════════════════════════

/** GET /users/me/certificados → los suyos, del más reciente al más viejo. */
router.get('/me/certificados', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.json({ status: 'ok', certificados: [] })

    const { rows } = await query(
      'SELECT nombre_certificado FROM usuarios WHERE id = $1', [req.user.userId])

    res.json({
      status:        'ok',
      certificados:  await certificadoService.deUsuario(email),
      // El front usa esto para decidir si muestra el pop-up del nombre. Se
      // manda aquí para no obligarlo a una segunda llamada.
      nombreCertificado: rows[0]?.nombre_certificado ?? null,
    })
  } catch (err) { next(err) }
})

export default router
