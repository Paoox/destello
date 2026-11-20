/**
 * Destello API — Users Routes
 * GET  /users/me        → perfil del usuario autenticado
 * PUT  /users/me        → actualizar perfil
 * GET  /users/me/progress → progreso en talleres
 */
import { Router } from 'express'
import { query, withTransaction } from '../db/db.js'
import * as chispaService from '../services/chispaService.js'
import * as referralService from '../services/referralService.js'
import * as usuarioService from '../services/usuarioService.js'
import { sincronizarEstadoCupo } from '../services/cupoService.js'
import { registrarEvento } from '../services/eventoService.js'
import * as asistenciaService from '../services/asistenciaService.js'
import * as certificadoService from '../services/certificadoService.js'
import { crearTokenVideo } from '../services/videoService.js'
import { esProfeDelTaller } from '../services/profesorService.js'
import { validarFoto } from '../services/fotoPerfil.js'
import * as datosPagoService from '../services/datosPagoService.js'
import * as notificacionService from '../services/notificacionService.js'
import * as ajustesService from '../services/ajustesService.js'
import * as habitatService from '../services/habitatService.js'

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
      `SELECT id, email, nombre, apellido, whatsapp, estado, foto,
              estrellas, racha, codigo_referido, referido_por,
              -- Saldo de Supernovas (migración 027): suma del libro mayor.
              (SELECT COALESCE(SUM(cantidad), 0)::int FROM supernovas_movimientos m
                WHERE m.usuario_id = usuarios.id) AS supernovas
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
      // Cerrado el 19 nov 2026 (T-45): cambiar el WhatsApp sin probar que el
      // número nuevo es tuyo dejaba que quien tuviera una sesión abierta
      // ajena pusiera su número y se quedara con el login por código. Ahora
      // solo se cambia con código: POST /users/me/whatsapp/codigo + /confirmar.
      return res.status(400).json({
        status:  'error',
        code:    'USA_AJUSTES',
        message: 'El WhatsApp se cambia desde Ajustes, confirmando con un código.',
      })
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

// ── Foto de perfil ─────────────────────────────────────────────────────────
//
// PUT /users/me/foto  body { foto: dataURL | null }
// El navegador la recorta a 256×256 ANTES de mandarla (ver PagePerfil.jsx),
// así que aquí solo se acepta una imagen chica y en formato de imagen — nada
// de URLs externas (las de Google entran solas en el login) ni archivos
// grandes que inflen la base. `null` la quita.
router.put('/me/foto', async (req, res, next) => {
  try {
    const { foto, error } = validarFoto(req.body?.foto)
    if (error) return res.status(400).json({ status: 'error', message: error })
    const { rows } = await query(
      'UPDATE usuarios SET foto = $1, updated_at = NOW() WHERE id = $2 RETURNING foto',
      [foto, req.user.userId]
    )
    if (!rows.length) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
    res.json({ status: 'ok', foto: rows[0].foto })
  } catch (err) { next(err) }
})

// ── Datos de pago (solo profesoras) ────────────────────────────────────────
// A dónde depositarle. Ella los ve y edita aquí; Paola en Admin → Profesores.
router.get('/me/datos-pago', async (req, res, next) => {
  try {
    res.json({ status: 'ok', datosPago: await datosPagoService.obtener(req.user.userId) })
  } catch (err) { next(err) }
})

router.put('/me/datos-pago', async (req, res, next) => {
  try {
    res.json({ status: 'ok', datosPago: await datosPagoService.guardar(req.user.userId, req.body ?? {}) })
  } catch (err) { next(err) }
})

// ── Talleres sugeridos ─────────────────────────────────────────────────────
//
// GET /users/me/sugerencias → hasta 4 talleres abiertos (activos o
// próximamente) que la persona NO tiene ni da, primero los de la misma
// categoría que los que ya tomó ("similares"), luego los más próximos.
router.get('/me/sugerencias', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
    const suyos = await chispaService.getTalleresDelUsuario(email, req.user.userId)
    const ids   = suyos.map(t => t.tallerId)
    const cats  = [...new Set(suyos.map(t => t.categoria).filter(Boolean))]
    const { rows } = await query(
      `SELECT id, nombre, descripcion, categoria, precio, horario, imagen_url,
              to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, estado,
              (categoria = ANY($2::text[])) AS similar
         FROM talleres
        WHERE estado IN ('activo', 'proximamente')
          AND NOT (id = ANY($1::text[]))
          AND (fecha_inicio IS NULL OR fecha_inicio >= (NOW() AT TIME ZONE 'America/Mexico_City')::date)
        ORDER BY (categoria = ANY($2::text[])) DESC, fecha_inicio ASC NULLS LAST, nombre
        LIMIT 4`,
      [ids, cats]
    )
    res.json({ status: 'ok', sugerencias: rows })
  } catch (err) { next(err) }
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
    const talleres = await chispaService.getTalleresDelUsuario(email, req.user.userId)
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

// ── Referidos (19 nov 2026, migración 028) ──
// El canje viejo de Supernovas con Estrellas (POST /me/supernovas/:id/canjear)
// se retiró: las Supernovas son la moneda y se gastan en el Hábitat.
router.get('/me/referidos', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await referralService.resumenReferidos(req.user.userId)) }) }
  catch (err) { next(err) }
})

/** "¿Alguien te habló de Destello?" — captura el código de quien la invitó. */
router.post('/me/referido', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
    const r = await referralService.registrarReferido(req.body?.codigo, email)
    if (!r.ok) {
      return res.status(409).json({ status: 'error', reason: r.reason,
        message: referralService.MOTIVO_REFERIDO[r.reason] ?? 'No se pudo registrar el código' })
    }
    // Si ya había pagado algún taller, quien la invitó gana desde ahora.
    await referralService.avisarRecompensa(await withTransaction(q => referralService.recompensarReferido(email, q)))
    res.json({ status: 'ok', ...(await referralService.resumenReferidos(req.user.userId)) })
  } catch (err) { next(err) }
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
// ── Sellos (19 nov 2026, migración 028) ──
// La profe pone un sello en clase → el aula avisa a PageAula (contrato:
// `sesion.alSellar`) → se guarda aquí. Solo la profe del taller o una cuenta
// admin; solo a personas con acceso a ese taller. Un sello por taller una vez.
const SELLO_ID = /^[a-z][a-z0-9_-]{1,30}$/
router.post('/me/aula/:tallerId/sellos', async (req, res, next) => {
  try {
    const tallerId = req.params.tallerId
    const email = await emailDelUsuario(req.user.userId)
    const esAdmin = (process.env.ADMIN_EMAILS ?? '').split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
      .includes(String(email ?? '').toLowerCase())
    if (!esAdmin && !(await esProfeDelTaller(req.user.userId, tallerId))) {
      return res.status(403).json({ status: 'error', message: 'Solo la profe del taller puede poner sellos' })
    }
    const sello = String(req.body?.sello ?? '')
    const ids = [...new Set((Array.isArray(req.body?.alumnos) ? req.body.alumnos : []).map(Number).filter(Number.isInteger))].slice(0, 200)
    if (!SELLO_ID.test(sello) || !ids.length) return res.status(400).json({ status: 'error', message: 'Datos inválidos' })

    // La actividad que estaba abierta en el pizarrón viaja con el sello (029).
    const act = req.body?.actividad ?? null
    const actividadId   = act && SELLO_ID.test(String(act.id ?? '')) ? String(act.id) : null
    const actividadTipo = actividadId && /^[a-z0-9]{2,20}$/.test(String(act.tipo ?? '')) ? String(act.tipo) : null
    const acceso        = ['siempre', '30dias', 'premium'].includes(act?.acceso) ? act.acceso : 'siempre'

    const { rows: alumnos } = await query('SELECT id, email FROM usuarios WHERE id = ANY($1::int[])', [ids])
    let guardados = 0
    for (const a of alumnos) {
      if (a.id === req.user.userId) continue
      if (!(await asistenciaService.tieneAcceso(a.email, tallerId, a.id))) continue
      const { rowCount } = await query(
        `INSERT INTO insignias (usuario_email, nombre, taller_id, otorgada_por, actividad_id, actividad_tipo, acceso)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING`,
        [a.email, sello, tallerId, email, actividadId, actividadTipo, acceso])
      guardados += rowCount
    }
    res.json({ status: 'ok', guardados })
  } catch (err) { next(err) }
})

/** Mis sellos (Hábitat): cuáles, de qué taller, qué actividad abren y su reto. */
router.get('/me/sellos', async (req, res, next) => {
  try { res.json({ status: 'ok', sellos: await habitatService.sellos(req.user.userId) }) }
  catch (err) { next(err) }
})
router.post('/me/sellos/:id/jugar', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await habitatService.iniciarJuego(req.user.userId, req.params.id)) }) }
  catch (err) { next(err) }
})
router.post('/me/habitat/juegos/:id/terminar', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await habitatService.terminarJuego(req.user.userId, Number(req.params.id))) }) }
  catch (err) { next(err) }
})

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

/**
 * GET /users/me/aula/:tallerId/video-token
 *
 * Token para conectar al servidor de video (LiveKit/OpenVidu) de ESTE taller.
 * Mismo candado que la presencia: se revisa acceso real en el servidor, no
 * solo lo que ya filtró el front.
 *
 * `video: null` en la respuesta (200, no error) cuando `LIVEKIT_URL`/llaves
 * no están configuradas — así el aula sigue mostrando "Sin video todavía" sin
 * que el front tenga que distinguir "no hay acceso" de "no hay servidor".
 */
router.get('/me/aula/:tallerId/video-token', async (req, res, next) => {
  try {
    const email = await emailDelUsuario(req.user.userId)
    if (!email) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

    if (!(await asistenciaService.tieneAcceso(email, req.params.tallerId, req.user.userId))) {
      return res.status(403).json({ status: 'error', message: 'No tienes acceso a este taller' })
    }

    const { rows } = await query(
      'SELECT nombre, apellido FROM usuarios WHERE id = $1', [req.user.userId])
    // Nombre y PRIMER apellido — es lo que se ve en la tira de personas y en
    // la cabecera del aula; mismo criterio que `chispaService` (T-43).
    const primerApellido = String(rows[0]?.apellido ?? '').trim().split(/\s+/)[0]
    const nombre = [String(rows[0]?.nombre ?? '').trim(), primerApellido].filter(Boolean).join(' ') || email

    // Profe = asignada a este taller (T-05) o cuenta admin (`ADMIN_EMAILS`
    // del .env — la misma lista que en el front decide quién entra como profe
    // a cualquier aula). El aula usa este rol para saber de quién aceptar
    // sellos, cambio de actividad, silenciar… (ver `videoService.js`).
    const esAdmin = (process.env.ADMIN_EMAILS ?? '')
      .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
      .includes(email.toLowerCase().trim())
    const esProfe = esAdmin || await esProfeDelTaller(req.user.userId, req.params.tallerId)

    const video = await crearTokenVideo({
      tallerId: req.params.tallerId,
      identity: String(req.user.userId),
      nombre,
      rol: esProfe ? 'profe' : 'alumno',
    })

    res.json({ status: 'ok', video })
  } catch (err) { next(err) }
})


// ══════════════════════════════════════════════════════════════════════════
//  Certificados del alumno
// ── Hábitat + Supernovas (19 nov 2026, migración 027) ──
router.get('/me/habitat', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await habitatService.estado(req.user.userId)) }) }
  catch (err) { next(err) }
})
router.post('/me/habitat/comprar', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await habitatService.comprar(req.user.userId, String(req.body?.objetoId ?? ''))) }) }
  catch (err) { next(err) }
})
router.put('/me/habitat', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await habitatService.acomodar(req.user.userId, req.body?.puestos)) }) }
  catch (err) { next(err) }
})

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

// ══════════════════════════════════════════════════════════════════════════
// Notificaciones (T-44) — las crea el revisor automático
// (notificacionService.revisarNotificaciones); aquí solo se leen y se marcan.
// ══════════════════════════════════════════════════════════════════════════

/** GET /users/me/notificaciones → las últimas 50 + cuántas sin leer. */
router.get('/me/notificaciones', async (req, res, next) => {
  try {
    const [notificaciones, noLeidas] = await Promise.all([
      notificacionService.listar(req.user.userId),
      notificacionService.contarNoLeidas(req.user.userId),
    ])
    res.json({ status: 'ok', notificaciones, noLeidas })
  } catch (err) { next(err) }
})

/** GET /users/me/notificaciones/no-leidas → solo el número, para la campanita. */
router.get('/me/notificaciones/no-leidas', async (req, res, next) => {
  try {
    res.json({ status: 'ok', noLeidas: await notificacionService.contarNoLeidas(req.user.userId) })
  } catch (err) { next(err) }
})

/** POST /users/me/notificaciones/leer → body { ids?: number[] }; sin ids, todas. */
router.post('/me/notificaciones/leer', async (req, res, next) => {
  try {
    const marcadas = await notificacionService.marcarLeidas(req.user.userId, req.body?.ids ?? null)
    res.json({ status: 'ok', marcadas })
  } catch (err) { next(err) }
})

// ══════════════════════════════════════════════════════════════════════════
// Ajustes (T-45) — la lógica vive en services/ajustesService.js
// ══════════════════════════════════════════════════════════════════════════

/** GET /users/me/ajustes → correo, WhatsApp y avisos. */
router.get('/me/ajustes', async (req, res, next) => {
  try { res.json({ status: 'ok', ajustes: await ajustesService.leer(req.user.userId) }) }
  catch (err) { next(err) }
})

/** PUT /users/me/avisos → body { avisosWhatsapp?, avisosCorreo? } */
router.put('/me/avisos', async (req, res, next) => {
  try { res.json({ status: 'ok', avisos: await ajustesService.guardarAvisos(req.user.userId, req.body ?? {}) }) }
  catch (err) { next(err) }
})

/** POST /users/me/whatsapp/codigo → body { whatsapp } (el número NUEVO) */
router.post('/me/whatsapp/codigo', async (req, res, next) => {
  try {
    await ajustesService.pedirCodigoWhatsapp(req.user.userId, req.body?.whatsapp)
    res.json({ status: 'ok', message: 'Te mandamos un código por WhatsApp al número nuevo' })
  } catch (err) { next(err) }
})

/** POST /users/me/whatsapp/confirmar → body { whatsapp, codigo } */
router.post('/me/whatsapp/confirmar', async (req, res, next) => {
  try {
    const r = await ajustesService.confirmarWhatsapp(req.user.userId, req.body?.whatsapp, req.body?.codigo)
    res.json({ status: 'ok', whatsapp: r.whatsapp })
  } catch (err) { next(err) }
})

/** POST /users/me/soporte → body { categoria, detalle, tallerId? } → tab Reportes del panel */
router.post('/me/soporte', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await ajustesService.reportarProblema(req.user.userId, req.body ?? {})) }) }
  catch (err) { next(err) }
})

/** GET /users/me/reportes → sus reportes con folio, estado y conversación */
router.get('/me/reportes', async (req, res, next) => {
  try { res.json({ status: 'ok', reportes: await ajustesService.misReportes(req.user.userId) }) }
  catch (err) { next(err) }
})

/** POST /users/me/reportes/:id/mensaje → body { texto }. Reabre el reporte y avisa a Paola. */
router.post('/me/reportes/:id/mensaje', async (req, res, next) => {
  try {
    const mensaje = await ajustesService.escribirEnReporte(req.user.userId, req.params.id,
      { texto: req.body?.texto, imagen: req.body?.imagen || null })
    res.json({ status: 'ok', mensaje })
  } catch (err) { next(err) }
})

/** POST /users/me/reportes/:id/cerrar → la persona da por resuelto su reporte */
router.post('/me/reportes/:id/cerrar', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await ajustesService.cerrarMiReporte(req.user.userId, req.params.id)) }) }
  catch (err) { next(err) }
})

/** GET /users/me/baja → qué pasaría (¿es profe? ¿tiene talleres pagados por venir?) */
router.get('/me/baja', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await ajustesService.previaBaja(req.user.userId)) }) }
  catch (err) { next(err) }
})

/** POST /users/me/baja → body { confirmacion: 'ELIMINAR', motivo? } */
router.post('/me/baja', async (req, res, next) => {
  try { res.json({ status: 'ok', ...(await ajustesService.pedirBaja(req.user.userId, req.body ?? {})) }) }
  catch (err) { next(err) }
})

export default router
