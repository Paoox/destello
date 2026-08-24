/**
 * Destello API — Bot Controller
 * Endpoints públicos que consume Faro (bot de WhatsApp).
 */

import { upsertUsuario, findByEmail } from '../services/usuarioService.js'
import { registrarEnLista, getListasPorEmail, getPendientesPorEmail } from '../services/listaEsperaService.js'
import { diagnosticar, completarWhatsapp } from '../services/diagnosticoService.js'
import { crearReporte, MOTIVOS } from '../services/reporteService.js'
import { subirComprobante, storageDisponible } from '../services/storageService.js'
import { AppError } from '../middleware/errorHandler.js'
import { guardarConversacion, obtenerConversacion } from '../services/botConversacionService.js'
import { registrarEvento } from '../services/eventoService.js'

/**
 * POST /bot/registrar
 * Crea o actualiza un usuario desde el bot.
 */
export async function registrarUsuario(req, res, next) {
    try {
        const { email, nombre, apellido, whatsapp } = req.body
        if (!email) throw new AppError('email es requerido', 400, 'BAD_REQUEST')

        const usuario = await upsertUsuario({ email, nombre, apellido, whatsapp })
        res.status(201).json({ status: 'ok', usuario })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /bot/usuario/:email
 * Verifica si un usuario existe y cuál es su estado.
 */
export async function buscarUsuario(req, res, next) {
    try {
        const usuario = await findByEmail(req.params.email)
        if (!usuario) return res.json({ status: 'ok', existe: false })
        // Los bloqueos salen a la superficie para que Faro no tenga que
        // conocer cómo se llaman las columnas de la base.
        res.json({
            status:            'ok',
            existe:            true,
            usuario,
            bloqueado:         usuario.acceso_bloqueado   === true,
            comprasBloqueadas: usuario.compras_bloqueadas === true,
        })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /bot/lista-espera
 * Registra a un usuario en la lista de espera de un taller.
 */
export async function agregarALista(req, res, next) {
    try {
        const { email, tallerId, nombre, whatsapp } = req.body
        if (!email)    throw new AppError('email es requerido', 400, 'BAD_REQUEST')
        if (!tallerId) throw new AppError('tallerId es requerido', 400, 'BAD_REQUEST')

        const resultado = await registrarEnLista({ email, tallerId, nombre, whatsapp, origen: 'bot' })
        res.status(201).json({ status: 'ok', ...resultado })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /bot/listas/:email
 * Devuelve todas las listas de espera activas de un usuario.
 */
export async function listasDeUsuario(req, res, next) {
    try {
        const listas = await getListasPorEmail(req.params.email)
        res.json({ status: 'ok', listas })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /bot/pendientes/:email
 * Verifica si hay chispas o resplandores pendientes para un email.
 */
export async function pendientesDeUsuario(req, res, next) {
    try {
        const pendientes = await getPendientesPorEmail(req.params.email)
        res.json({ status: 'ok', ...pendientes })
    } catch (err) {
        next(err)
    }
}

/**
 * GET /bot/diagnostico/:email
 * Foto completa del acceso de una persona, para que el bot ramifique sin
 * hacer cuatro llamadas distintas.
 */
export async function diagnosticoDeAcceso(req, res, next) {
    try {
        const diagnostico = await diagnosticar(req.params.email)
        res.json({ status: 'ok', ...diagnostico })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /bot/completar-whatsapp
 * Guarda el número de quien ya tiene permiso pero no lo tiene registrado.
 * Sin ese dato el login por número no funciona.
 */
export async function completarWhatsappDeUsuario(req, res, next) {
    try {
        const { email, whatsapp } = req.body
        if (!email)    throw new AppError('email es requerido', 400, 'BAD_REQUEST')
        if (!whatsapp) throw new AppError('whatsapp es requerido', 400, 'BAD_REQUEST')

        const resultado = await completarWhatsapp(email, whatsapp)
        res.json({ status: 'ok', ...resultado })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /bot/reporte-acceso
 * El alumno reporta que no puede entrar. Guarda el reporte y avisa a la admin
 * por WhatsApp. NO libera ningún taller — eso lo hace la admin tras verificar.
 */
export async function reportarAcceso(req, res, next) {
    try {
        const { email, nombre, whatsapp, motivo, detalle } = req.body
        if (!email)  throw new AppError('email es requerido', 400, 'BAD_REQUEST')
        if (!Object.values(MOTIVOS).includes(motivo)) {
            throw new AppError('motivo inválido', 400, 'BAD_REQUEST')
        }

        const resultado = await crearReporte({ email, nombre, whatsapp, motivo, detalle })
        res.status(201).json({ status: 'ok', ...resultado })
    } catch (err) {
        next(err)
    }
}

/**
 * POST /bot/reporte-pago
 * El alumno avisa que ya pagó — con foto de comprobante o escribiendo los datos.
 *
 * Guarda el reporte y avisa a la admin por WhatsApp. NO activa la cuenta ni
 * asigna talleres: eso lo hace Paola desde el panel DESPUÉS de cotejar contra el
 * banco. Un mensaje de WhatsApp no es comprobante de nada.
 *
 * Body: { email, nombre, whatsapp, tipo: 'comprobante'|'datos', datos?,
 *         tallerNombre?, comprobanteBase64?, comprobanteMime? }
 */
export async function reportarPago(req, res, next) {
    try {
        const {
            email, nombre, whatsapp, tipo, datos, tallerNombre,
            comprobanteBase64, comprobanteMime,
        } = req.body
        if (!email) throw new AppError('email es requerido', 400, 'BAD_REQUEST')

        // La imagen se sube ANTES de crear el reporte para poder guardar su ruta.
        // Si la subida falla, el reporte se crea igual sin imagen: perder la foto
        // es molesto, perder el aviso de un pago es grave.
        let comprobantePath = null
        if (comprobanteBase64) {
            if (!storageDisponible()) {
                console.warn('[reporte-pago] Storage sin configurar — el comprobante no se guardó')
            } else {
                try {
                    comprobantePath = await subirComprobante(
                        Buffer.from(comprobanteBase64, 'base64'),
                        comprobanteMime || 'image/jpeg',
                    )
                } catch (err) {
                    console.error('[reporte-pago] No se pudo guardar el comprobante:', err.message)
                }
            }
        }

        const lineas = []
        if (tallerNombre) lineas.push(`Taller: ${tallerNombre}`)
        lineas.push(tipo === 'comprobante'
            ? 'Mandó FOTO de comprobante por WhatsApp'
            : 'Escribió los datos de su pago')

        // `datos` viene del flujo por pasos del bot (banco, monto, titular…).
        // Se guarda como texto legible para que el reporte se entienda de un
        // vistazo, tanto en el panel como en el WhatsApp de aviso.
        if (datos && typeof datos === 'object') {
            const ETIQUETAS = {
                banco: 'Banco', monto: 'Monto', titular: 'Titular',
                fecha: 'Fecha y hora', folio: 'Folio/referencia',
            }
            for (const [clave, etiqueta] of Object.entries(ETIQUETAS)) {
                if (datos[clave]) lineas.push(`${etiqueta}: ${datos[clave]}`)
            }
        }

        const resultado = await crearReporte({
            email, nombre, whatsapp,
            motivo:  MOTIVOS.REPORTE_PAGO,
            detalle: lineas.join(' · '),
            comprobantePath,
            // Un segundo pago es legítimo: nunca lo silenciamos como duplicado.
            permitirDuplicado: true,
        })

        res.status(201).json({ status: 'ok', ...resultado })
    } catch (err) {
        next(err)
    }
}

// ════════════════════════════════════════════════════════════════════════════
//  Conversaciones y bitácora del bot
// ════════════════════════════════════════════════════════════════════════════
//
// El bot no habla con PostgreSQL — todo lo hace por HTTP contra esta API. Por
// eso guardar la conversación y registrar eventos necesita endpoints propios.
//
// Los tres son "mejor esfuerzo": si fallan, el bot debe seguir contestando
// igual. Nunca devuelven error al bot para que una falla de medición no le
// arruine la conversación a nadie.

/**
 * PUT /bot/conversacion/:jid
 * Guarda en qué paso va la conversación. Se llama en cada mensaje.
 */
export async function guardarConversacionBot(req, res) {
    const { whatsapp, email, paso, datos, completada } = req.body ?? {}
    const jid = await guardarConversacion({
        jid: req.params.jid, whatsapp, email, paso, datos, completada,
    })
    res.json({ status: 'ok', guardada: !!jid })
}

/**
 * GET /bot/conversacion/:jid
 * Recupera la conversación tras un reinicio del bot. Devuelve `null` si no hay
 * nada reciente que retomar (más de 6 h = mejor empezar de cero).
 */
export async function obtenerConversacionBot(req, res) {
    const conv = await obtenerConversacion(req.params.jid)
    res.json({ status: 'ok', conversacion: conv })
}

/**
 * POST /bot/evento
 * Deja un renglón en la bitácora. Body: { tipo, email, tallerId, metadata }
 */
export async function registrarEventoBot(req, res) {
    const { tipo, email, tallerId, metadata } = req.body ?? {}
    const id = await registrarEvento({
        tipo,
        usuarioEmail: email ?? null,
        tallerId:     tallerId ?? null,
        origen:       'bot',
        actor:        'faro',
        metadata:     metadata ?? {},
    })
    res.json({ status: 'ok', id })
}
