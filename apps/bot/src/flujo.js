/**
 * Destello — Faro 🌟
 * Bot de WhatsApp. Guía a los alumnos desde el primer contacto.
 *
 * MENÚ PRINCIPAL
 *   1. Registrarme a un taller
 *   2. Ver talleres disponibles
 *   3. No me llegó mi acceso  (diagnostica por correo y resuelve lo que puede)
 *   4. Medios de pago
 *   5. Tengo una duda
 *
 * FLUJO REGISTRO — opción 1 del menú:
 *   → REG_CORREO   (pedir email)
 *     ├── email existe → [si falta WA → REG_WHATSAPP] → REG_TALLER
 *     └── email nuevo  → REG_NOMBRE → REG_APELLIDO → [REG_WHATSAPP si @lid] → REG_TALLER
 *
 * FLUJO VER TALLERES — opción 2 del menú:
 *   → VER_TALLERES (lista numerada sin tope)
 *     ├── número de taller → se preselecciona (conv.tallerPre) → REG_CORREO → inscripción directa
 *     └── "menu" / "salir"
 *
 * NOTA @lid: si el JID es un ID interno de WhatsApp (`@lid`) el número no es
 * extraíble. Se intenta primero `senderPn` (que Baileys entrega con el número
 * real); si tampoco está, el bot lo pide explícitamente en REG_WHATSAPP.
 * NUNCA se guarda el raw del @lid como whatsapp.
 */

import fetch from 'node-fetch'

const API_URL = process.env.API_URL || 'http://localhost:3001'

const PAGO_TEXTO =
    '💳 *Medios de pago*\n\n' +
    '─────────────────────\n' +
    '🏦 *Transferencia SPEI*\n' +
    '• Banco: Inbursa\n' +
    '• CLABE: `036180500687558754`\n' +
    '• Titular: Paola Arreola\n\n' +
    '─────────────────────\n' +
    '🏪 *Pago en efectivo*\n' +
    'Depósito con número de tarjeta en:\n' +
    'Walmart · Bodega Aurrera · Sam\'s Club\n' +
    'OXXO · Sears · Sanborns\n\n' +
    '📌 Número de tarjeta:\n' +
    '`4658285017247424`\n' +
    '• Titular: Paola Arreola\n\n' +
    '─────────────────────\n' +
    '📸 Una vez realizado tu pago, envía tu *comprobante* por este chat y lo verificamos a la brevedad. 🙌'

// ── Estados de conversación ───────────────────────────────────
const PASO = {
    MENU:         'MENU',
    // Ver talleres (opción 2 del menú)
    VER_TALLERES: 'VER_TALLERES',
    // Flujo registro
    REG_CORREO:   'REG_CORREO',   // pedir email primero (unifica nuevo/existente)
    REG_NOMBRE:   'REG_NOMBRE',
    REG_APELLIDO: 'REG_APELLIDO',
    REG_WHATSAPP: 'REG_WHATSAPP', // pedir número cuando no se pudo extraer del JID
    REG_TALLER:   'REG_TALLER',
    // Sin acceso (opción 3)
    SIN_CODIGO:   'SIN_CODIGO',   // pedir correo
    SIN_ACCESO:   'SIN_ACCESO',   // escalamiento cuando lo resuelto no le sirvió
    // Después de completar cualquier flujo
    POST_ACCION:  'POST_ACCION',
}

/**
 * Extrae el número local de 10 dígitos.
 *   "521XXXXXXXXXX@s.whatsapp.net" → 13 dígitos → quitar "521"
 *   "52XXXXXXXXXX@s.whatsapp.net"  → 12 dígitos → quitar "52"
 *   "XXXXXXXXXXXXXXX@lid"          → ID interno, NO extraíble → null
 *
 * @param {string}  jid      JID del chat
 * @param {string?} senderPn JID real que Baileys puede adjuntar cuando el chat es @lid
 */
function extractWhatsapp(jid, senderPn = null) {
    // Si el JID es @lid, el número real puede venir en senderPn
    const fuente = (jid && jid.includes('@lid')) ? senderPn : jid
    if (!fuente || fuente.includes('@lid')) return null

    const raw = String(fuente).replace('@s.whatsapp.net', '').replace('@c.us', '').replace(/\D/g, '')
    if (raw.startsWith('521') && raw.length === 13) return raw.slice(3)
    if (raw.startsWith('52')  && raw.length === 12) return raw.slice(2)
    if (raw.length === 10) return raw
    return null
}

const conversaciones = new Map()

/**
 * Datos del alumno que se conservan al cambiar de flujo dentro de la MISMA
 * conversación, para no volver a preguntarle el correo. Deja fuera el estado
 * temporal (talleres cargados, taller preseleccionado) que sí debe limpiarse.
 */
function datosUsuario(conv = {}) {
    const { correo, nombre, apellido, whatsapp, tienePerfil } = conv
    return { correo, nombre, apellido, whatsapp, tienePerfil }
}

/** Nombre completo para tablas que tienen una sola columna (lista_espera). */
function nombreCompleto(conv = {}) {
    return [conv.nombre, conv.apellido].filter(Boolean).join(' ').trim() || null
}

// ── Helpers de API ────────────────────────────────────────────

async function getTalleresActivos() {
    try {
        const res  = await fetch(`${API_URL}/tallers`)
        const data = await res.json()
        return data.tallers || []
    } catch { return [] }
}

async function buscarUsuario(email) {
    try {
        const res  = await fetch(`${API_URL}/bot/usuario/${encodeURIComponent(email)}`)
        const data = await res.json()
        return data
    } catch { return { existe: false } }
}

async function registrarUsuario({ email, nombre, apellido, whatsapp }) {
    try {
        const res = await fetch(`${API_URL}/bot/registrar`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, nombre, apellido, whatsapp }),
        })
        return await res.json()
    } catch { return { status: 'error' } }
}

async function agregarALista({ email, tallerId, nombre, whatsapp }) {
    try {
        const res = await fetch(`${API_URL}/bot/lista-espera`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, tallerId, nombre, whatsapp }),
        })
        return await res.json()
    } catch { return { status: 'error' } }
}

/** Listas de espera del usuario, con el estado de cada una. */
async function getListas(email) {
    try {
        const res  = await fetch(`${API_URL}/bot/listas/${encodeURIComponent(email)}`)
        const data = await res.json()
        return data.listas || []
    } catch { return [] }
}

/** Foto completa del acceso: si tiene permiso, sus talleres y sus listas. */
async function getDiagnostico(email) {
    try {
        const res = await fetch(`${API_URL}/bot/diagnostico/${encodeURIComponent(email)}`)
        return await res.json()
    } catch { return { status: 'error' } }
}


/**
 * Guarda el número de quien ya tiene permiso pero no lo tiene registrado.
 * Sin este dato no puede entrar con "mi número" en el login.
 */
async function completarWhatsapp(email, whatsapp) {
    try {
        const res = await fetch(`${API_URL}/bot/completar-whatsapp`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, whatsapp }),
        })
        return await res.json()
    } catch { return { actualizado: false } }
}

/** Levanta un reporte para que la admin lo revise. NO libera nada. */
async function reportarAcceso({ email, nombre, whatsapp, motivo, detalle }) {
    try {
        const res = await fetch(`${API_URL}/bot/reporte-acceso`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, nombre, whatsapp, motivo, detalle }),
        })
        return await res.json()
    } catch { return { status: 'error' } }
}

// ── Textos reutilizables ──────────────────────────────────────

const MENU_TEXTO = (nombre = '') =>
    `${nombre ? `Hola de nuevo, *${nombre.split(' ')[0]}*! 👋\n\n` : ''}` +
    '¿En qué puedo ayudarte?\n\n' +
    '1️⃣  Quiero registrarme a un taller\n' +
    '2️⃣  Ver talleres disponibles\n' +
    '3️⃣  No me llegó mi acceso\n' +
    '4️⃣  Medios de pago\n' +
    '5️⃣  Tengo una duda'

const POST_ACCION_TEXTO =
    '¿Puedo ayudarte con algo más?\n\n' +
    '1️⃣  Volver al menú\n' +
    '2️⃣  Salir'

const VER_TALLERES_PIE =
    '─────────────────────\n' +
    '👉 Escribe el *número* del taller que te interesa y te apunto a la lista de espera.\n\n' +
    '_O escribe *menu* para volver · *salir* para terminar._'

const ADIOS_TEXTO =
    '¡Hasta pronto! 👋✨\n\n' +
    'Cuando quieras, escríbeme y con gusto te ayudo.\n\n' +
    '_— Faro, tu guía en Destello_'

const SALUDO_INICIAL =
    '✨ ¡Hola! Soy *Faro*, tu guía en *Destello*.\n\n' +
    'Te acompaño en cada paso de tu aprendizaje.\n\n' +
    '¿Cómo puedo ayudarte hoy?\n\n' +
    '1️⃣  Quiero registrarme a un taller\n' +
    '2️⃣  Ver talleres disponibles\n' +
    '3️⃣  No me llegó mi acceso\n' +
    '4️⃣  Medios de pago\n' +
    '5️⃣  Tengo una duda'

const MOTIVOS = {
    SIN_PLATAFORMA: 'sin_acceso_plataforma',
    SIN_TALLER:     'sin_acceso_taller',
}

/**
 * Escalamiento: se muestra DESPUÉS de haberle resuelto lo que la BD permitía.
 * Solo llega aquí quien ya tiene cuenta y talleres activos, así que si insiste
 * es un caso real que la admin debe mirar.
 */
const SIN_ACCESO_MENU =
    '¿Sigue sin funcionarte?\n\n' +
    '1️⃣  Sigo sin ver mi taller\n' +
    '2️⃣  No puedo entrar a mi cuenta\n' +
    '3️⃣  Todo bien, volver al menú'

const REPORTE_ENVIADO_TEXTO =
    '✅ *Listo, ya lo reportamos.*\n\n' +
    'Danos unos *20 minutos* para revisar tu caso y liberar tu acceso. ' +
    'En cuanto esté te escribimos por aquí. 🙌\n\n' +
    '💡 _Recuerda que el material del taller se abre *después* de haber tomado la clase, ' +
    'así que si tu taller aún no empieza es normal que todavía no veas contenido._\n\n' +
    POST_ACCION_TEXTO

const PEDIR_WHATSAPP_TEXTO =
    '📱 Para poder avisarte de tu lugar, ¿cuál es tu número de *WhatsApp a 10 dígitos*?\n\n' +
    '_Escríbelo sin espacios ni guiones, ej: 5512345678_'

function fmtFecha(iso) {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d)) return null
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Numeración sin tope: emoji hasta el 10, número normal de ahí en adelante. */
const EMOJIS_NUM = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟']
function numeroLista(i) {
    return EMOJIS_NUM[i] || `*${i + 1}.*`
}

function menuTalleres(talleres, titulo = '*Talleres disponibles:*') {
    if (!talleres.length) {
        return '😔 Por el momento no hay talleres disponibles. ¡Pronto abriremos nuevas fechas!'
    }
    return (
        titulo + '\n\n' +
        talleres.map((t, i) => {
            const precio  = t.precio > 0 ? `\n   💰 $${Number(t.precio).toLocaleString('es-MX')} MXN` : '\n   💰 Gratis'
            const horario = t.horario     ? `\n   🕐 ${t.horario}` : ''
            const fecha   = fmtFecha(t.fecha_inicio) ? `\n   📅 ${fmtFecha(t.fecha_inicio)}` : ''
            const prox    = t.estado === 'proximamente' ? ' _(Próximamente)_' : ''
            return `${numeroLista(i)}  *${t.nombre}*${prox}${precio}${horario}${fecha}`
        }).join('\n\n')
    )
}

/** Resuelve un taller a partir de un número o del nombre escrito. */
function resolverTaller(input, talleres) {
    const txt = String(input).toLowerCase().trim()
    const num = parseInt(txt, 10)
    if (!isNaN(num) && num >= 1 && num <= talleres.length) return talleres[num - 1]
    if (txt.length < 3) return null
    return talleres.find(t => t.nombre.toLowerCase().includes(txt)) || null
}

/**
 * Inscribe en lista de espera y deja la conversación en POST_ACCION.
 * Único punto donde se llama a /bot/lista-espera.
 */
async function inscribirEnTaller(jid, conv, taller) {
    const { correo, tienePerfil } = conv
    // lista_espera tiene una sola columna de nombre → aquí sí va completo
    const nombre = nombreCompleto(conv) || conv.nombre

    const resultado = await agregarALista({
        email:    correo,
        tallerId: taller.id,
        nombre,
        whatsapp: conv.whatsapp || null,
    })

    conversaciones.set(jid, { paso: PASO.POST_ACCION })

    if (resultado.status === 'error') {
        return (
            '😕 Tuvimos un problema al guardar tu registro. Intenta de nuevo en un momento, por favor.\n\n' +
            POST_ACCION_TEXTO
        )
    }

    if (!resultado.nuevo) {
        return (
            `ℹ️ *${nombre?.split(' ')[0] || 'Hola'}*, ya estás en la lista de espera de *${taller.nombre}*.\n\n` +
            'Te avisaremos en cuanto haya un lugar disponible. 🙌\n\n' +
            POST_ACCION_TEXTO
        )
    }

    if (tienePerfil) {
        return (
            '🎉 *¡Listo!* Quedaste registrado/a en la lista de espera de:\n\n' +
            `📚 *${taller.nombre}*\n\n` +
            'Te notificaremos aquí y por correo cuando confirmemos tu cupo. ¡Estás muy cerca! ✨\n\n' +
            POST_ACCION_TEXTO
        )
    }

    return (
        '🎉 *¡Registro completado!*\n\n' +
        `Quedaste en la lista de espera de:\n📚 *${taller.nombre}*\n\n` +
        '📬 Te avisamos por aquí y por correo en cuanto confirmemos tu lugar, ' +
        'junto con los datos para completar tu inscripción.\n\n' +
        '_¡Mantente pendiente!_ 🌟\n\n' +
        POST_ACCION_TEXTO
    )
}

/**
 * Paso siguiente una vez que ya tenemos correo + nombre + whatsapp:
 *   - si venía un taller preseleccionado (opción 2) → inscribir directo
 *   - si no → mostrar la lista para que elija
 */
async function continuarTrasDatos(jid, conv, encabezado) {
    if (conv.tallerPre) {
        return `${encabezado}\n\n` + await inscribirEnTaller(jid, conv, conv.tallerPre)
    }

    const talleres = conv.talleres?.length ? conv.talleres : await getTalleresActivos()

    if (!talleres.length) {
        conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION })
        return (
            `${encabezado}\n\n` +
            '😔 Por el momento no hay talleres disponibles, pero cuando abran nuevas fechas puedes volver a escribirme.\n\n' +
            POST_ACCION_TEXTO
        )
    }

    conversaciones.set(jid, { ...conv, paso: PASO.REG_TALLER, talleres })
    return (
        `${encabezado}\n\n` +
        '¿A qué taller te quieres inscribir?\n\n' +
        menuTalleres(talleres)
    )
}

/**
 * Opción 3 — "No me llegó mi acceso".
 * Resuelve solo lo que puede y pregunta únicamente cuando hace falta.
 *
 * Reglas de negocio (ver docs/flujo-acceso-bot.md):
 *   - Al usuario NUNCA se le manda un código. Solo la liga de login.
 *   - `usuarios.estado = 'activo'` significa que Paola ya le dio permiso.
 *   - Si está activo y le falta el WhatsApp en la BD, el bot lo guarda solo:
 *     sin ese dato el login por número no funciona.
 *   - El bot NUNCA activa un taller ni registra un pago. Solo reporta.
 */
async function resolverAcceso(jid, conv, correo, waDelJid) {
    const d = await getDiagnostico(correo)

    const datos = {
        ...datosUsuario(conv),
        correo,
        nombre:   d.usuario?.nombre   || conv.nombre || null,
        whatsapp: d.usuario?.whatsapp || waDelJid    || null,
    }
    const primerNombre = datos.nombre?.split(' ')[0] || 'Hola'
    const cerrar = (texto) => {
        conversaciones.set(jid, { ...datos, paso: PASO.POST_ACCION })
        return texto + '\n\n' + POST_ACCION_TEXTO
    }

    // Si la API falla, no dejamos al usuario sin respuesta
    if (d.status !== 'ok') {
        return cerrar(
            '😕 No pude revisar tu información en este momento.\n\n' +
            'Intenta de nuevo en unos minutos, por favor.'
        )
    }

    // ── A. No está registrado ─────────────────────────────────
    if (!d.existe) {
        return cerrar(
            `🔍 No encontramos ningún registro con *${correo}*.\n\n` +
            'Puede que te hayas registrado con otro correo, o que aún no estés inscrito/a.\n\n' +
            '_Escribe *menu* y elige la opción 1 para registrarte a un taller._'
        )
    }

    // ── B. Ya tiene permiso de entrar ─────────────────────────
    if (d.activo) {
        // Sin número guardado no puede entrar por WhatsApp. Lo completamos en
        // silencio con el número desde el que nos está escribiendo.
        if (d.faltaWhatsapp && waDelJid) {
            await completarWhatsapp(correo, waDelJid)
        }

        const conTalleres = d.talleres?.length > 0
            ? '\n\nTus talleres activos:\n' +
              d.talleres.map(t => `• *${t.nombre}*${fmtCuando(t)}`).join('\n') +
              '\n\n💡 _El material de cada taller se abre *después* de la clase, así que si el ' +
              'tuyo todavía no empieza es normal que aún no veas contenido._'
            : '\n\n_Todavía no tienes talleres asignados, pero tu cuenta ya funciona._'

        conversaciones.set(jid, { ...datos, paso: PASO.SIN_ACCESO })
        return (
            `¡Todo listo, *${primerNombre}*! ✨\n\n` +
            'Tu cuenta ya está activa. Entra aquí:\n' +
            '🔗 *destello.courses/login*\n\n' +
            'Puedes entrar con *Google* o con *tu número de WhatsApp* — si eliges tu número, ' +
            'te mandamos un código de 6 dígitos por este mismo chat.' +
            conTalleres + '\n\n' +
            '─────────────────────\n' +
            SIN_ACCESO_MENU
        )
    }

    // ── C. Está en lista pero sin permiso todavía ─────────────

    // Su pago SÍ está registrado pero la cuenta no quedó activada.
    // Es una inconsistencia nuestra, no del usuario → se reporta.
    if (d.pagadoSinActivar) {
        await reportarAcceso({
            email:    correo,
            nombre:   datos.nombre,
            whatsapp: datos.whatsapp,
            motivo:   MOTIVOS.SIN_PLATAFORMA,
            detalle:  `Pago registrado en "${d.pagadoSinActivar.taller_nombre}" pero usuarios.estado sigue en espera. Activar cuenta.`,
        })
        return cerrar(
            `*${primerNombre}*, tu pago de *${d.pagadoSinActivar.taller_nombre}* ya está registrado ✅\n\n` +
            'Nos falta terminar de activar tu acceso. Danos unos minutos y te escribimos ' +
            'por aquí en cuanto esté listo. 🙌'
        )
    }

    if (d.cupoConfirmado) {
        return cerrar(
            `*${primerNombre}*, ya tienes tu lugar apartado en *${d.cupoConfirmado.taller_nombre}* 🎟️\n\n` +
            'Todavía no nos aparece registrado tu pago, por eso tu acceso sigue sin activarse.\n\n' +
            'Si ya pagaste, mándanos tu *comprobante* por este chat y lo verificamos. 🙌\n\n' +
            '─────────────────────\n' +
            PAGO_TEXTO
        )
    }

    if (d.listas?.length > 0) {
        return cerrar(
            `📋 *${primerNombre}*, estás en la lista de espera de:\n\n` +
            d.listas.map(l => `• *${l.taller_nombre}*`).join('\n') + '\n\n' +
            'Todavía no confirmamos tu lugar, por eso aún no tienes acceso. ' +
            'En cuanto haya cupo te avisamos por aquí y por correo. 🙌'
        )
    }

    // Registrado pero sin ningún taller
    return cerrar(
        `*${primerNombre}*, te encontramos pero no estás inscrito/a en ningún taller.\n\n` +
        '_Escribe *menu* y elige la opción 1 para registrarte._'
    )
}

/** " — inicia el 3 de agosto" / " — en curso", según las fechas del taller. */
function fmtCuando(taller) {
    const inicio = fmtFecha(taller.fechaInicio)
    if (!inicio) return ''
    const yaEmpezo = new Date(taller.fechaInicio) <= new Date()
    return yaEmpezo ? ' _(en curso)_' : ` — inicia el ${inicio}`
}

// ── Procesador principal ──────────────────────────────────────

export async function procesarMensaje(jid, texto, senderPn = null) {
    const msg  = texto.trim()
    const conv = conversaciones.get(jid) || { paso: PASO.MENU, esNuevo: true }

    // Número real del remitente (null si es @lid sin senderPn)
    const waDelJid = extractWhatsapp(jid, senderPn)

    // "menu" o "cancelar" reinician siempre
    if (['menu', 'menú', 'cancelar', 'inicio'].includes(msg.toLowerCase())) {
        conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.MENU, esNuevo: false })
        return MENU_TEXTO()
    }

    // "salir" o "adios" terminan la conversación
    if (['salir', 'adiós', 'adios', 'bye', 'chao', 'hasta luego'].includes(msg.toLowerCase())) {
        conversaciones.delete(jid)
        return ADIOS_TEXTO
    }

    // ── MENÚ PRINCIPAL ────────────────────────────────────────
    if (conv.paso === PASO.MENU) {
        if (conv.esNuevo) {
            conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
            return SALUDO_INICIAL
        }

        switch (msg) {
            case '1':
                // Directo al correo — sin preguntar si ya tiene perfil
                conversaciones.set(jid, { paso: PASO.REG_CORREO })
                return (
                    '¡Perfecto! 😊\n\n' +
                    '¿Cuál es tu *correo electrónico*?\n\n' +
                    '_Lo usamos para identificar tu perfil en Destello._'
                )

            case '2': {
                const talleres = await getTalleresActivos()
                if (!talleres.length) {
                    conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION })
                    return (
                        '😔 Por el momento no hay talleres disponibles. ¡Pronto abriremos nuevas fechas!\n\n' +
                        POST_ACCION_TEXTO
                    )
                }
                conversaciones.set(jid, { paso: PASO.VER_TALLERES, talleres })
                return menuTalleres(talleres) + '\n\n' + VER_TALLERES_PIE
            }

            case '3': {
                // Si ya nos dio su correo en esta conversación, no se lo volvemos a pedir
                if (conv.correo) {
                    return await resolverAcceso(jid, conv, conv.correo, waDelJid)
                }
                conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.SIN_CODIGO })
                return (
                    'Entendido, te ayudo a revisarlo. 🔍\n\n' +
                    '¿Cuál es el correo con el que te registraste?'
                )
            }

            case '4':
                conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION })
                return PAGO_TEXTO + '\n\n' + POST_ACCION_TEXTO

            case '5':
                conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION })
                return (
                    '💬 *¿Tienes una duda?*\n\n' +
                    'Próximamente tendremos una sección de preguntas frecuentes.\n\n' +
                    'Por ahora escríbenos tu duda aquí y te respondemos a la brevedad. 😊\n\n' +
                    POST_ACCION_TEXTO
                )

            default:
                return MENU_TEXTO()
        }
    }

    // ── VER TALLERES: elegir taller directo desde la lista ────
    if (conv.paso === PASO.VER_TALLERES) {
        const talleres = conv.talleres || []
        const taller   = resolverTaller(msg, talleres)

        if (!taller) {
            return (
                '⚠️ No reconocí esa opción.\n\n' +
                menuTalleres(talleres) + '\n\n' +
                VER_TALLERES_PIE
            )
        }

        // Si ya nos dio sus datos en esta conversación, lo inscribimos directo
        if (conv.correo && conv.nombre) {
            return `¡Excelente elección! 📚 *${taller.nombre}*\n\n` +
                   await inscribirEnTaller(jid, { ...conv, tallerPre: null }, taller)
        }

        conversaciones.set(jid, {
            ...conv,
            paso:      PASO.REG_CORREO,
            tallerPre: taller,
            talleres,
        })
        return (
            `¡Excelente elección! 📚 *${taller.nombre}*\n\n` +
            '¿Cuál es tu *correo electrónico*?\n\n' +
            '_Lo usamos para identificar tu perfil en Destello._'
        )
    }

    // ── REGISTRO: correo (punto de entrada unificado) ─────────
    //   - Usuario existe → [si le falta WhatsApp, pedirlo] → taller
    //   - Usuario nuevo   → nombre → apellido → [WhatsApp si hace falta] → taller
    if (conv.paso === PASO.REG_CORREO) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(msg)) {
            return '⚠️ Ese correo no parece válido. Escríbelo completo, ej: _tunombre@gmail.com_'
        }

        const { existe, usuario } = await buscarUsuario(msg)

        if (existe) {
            const whatsapp = usuario.whatsapp || waDelJid
            const base = {
                ...conv,
                correo:      msg,
                nombre:      usuario.nombre,
                whatsapp:    whatsapp || null,
                tienePerfil: usuario.estado === 'activo',
            }
            const saludo = usuario.estado === 'espera'
                ? `¡Te reconocí, *${usuario.nombre?.split(' ')[0]}*! 👋`
                : `¡Hola de nuevo, *${usuario.nombre?.split(' ')[0]}*! 😊`

            // ⚠️ Usuario existente sin WhatsApp y JID @lid → pedirlo antes de seguir
            if (!whatsapp) {
                conversaciones.set(jid, { ...base, paso: PASO.REG_WHATSAPP })
                return `${saludo}\n\n` + PEDIR_WHATSAPP_TEXTO
            }

            return await continuarTrasDatos(jid, base, saludo)
        }

        // No existe → pedir nombre (aún no se registra nada en BD)
        conversaciones.set(jid, { ...conv, paso: PASO.REG_NOMBRE, correo: msg })
        return (
            '¡Bienvenido/a! 🎉\n\n' +
            '¿Cuál es tu *nombre*?\n\n' +
            '_Lo usamos para personalizar tus diplomas._'
        )
    }

    // ── REGISTRO: nombre ──────────────────────────────────────
    if (conv.paso === PASO.REG_NOMBRE) {
        conversaciones.set(jid, { ...conv, paso: PASO.REG_APELLIDO, nombre: msg.trim() })
        return (
            `Hola, *${msg.trim()}*! 😊\n\n` +
            '¿Cuál es tu *apellido*?\n\n' +
            '_Lo necesitamos para tu certificado._'
        )
    }

    // ── REGISTRO: apellido ────────────────────────────────────
    //   Nombre y apellido se guardan en columnas SEPARADAS de `usuarios`.
    //   No concatenarlos: el certificado y el diploma los necesitan aparte.
    if (conv.paso === PASO.REG_APELLIDO) {
        const apellido = msg.trim()
        const base = { ...conv, apellido, whatsapp: waDelJid, tienePerfil: false }

        // Sin número extraíble (@lid) → pedirlo ANTES de registrar en BD
        if (!waDelJid) {
            conversaciones.set(jid, { ...base, paso: PASO.REG_WHATSAPP })
            return `Gracias, *${conv.nombre}* 🙌\n\n` + PEDIR_WHATSAPP_TEXTO
        }

        await registrarUsuario({
            email:    conv.correo,
            nombre:   conv.nombre,
            apellido,
            whatsapp: waDelJid,
        })

        return await continuarTrasDatos(jid, base, '✅ *¡Registro guardado!*')
    }

    // ── REGISTRO: número de WhatsApp (cuando el JID es @lid) ──
    if (conv.paso === PASO.REG_WHATSAPP) {
        const numero = msg.replace(/\D/g, '')
        if (numero.length !== 10) {
            return (
                '⚠️ El número debe tener exactamente *10 dígitos*.\n\n' +
                'Escríbelo sin espacios ni guiones, ej: _5512345678_'
            )
        }

        await registrarUsuario({
            email:    conv.correo,
            nombre:   conv.nombre,
            apellido: conv.apellido,
            whatsapp: numero,
        })

        const base = { ...conv, whatsapp: numero }
        return await continuarTrasDatos(jid, base, '✅ *¡Listo!* 📱')
    }

    // ── REGISTRO: selección de taller ────────────────────────
    if (conv.paso === PASO.REG_TALLER) {
        const { talleres = [] } = conv

        if (!talleres.length) {
            conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
            return '😔 No hay talleres disponibles en este momento.\n\n' + MENU_TEXTO()
        }

        const tallerElegido = resolverTaller(msg, talleres)

        if (!tallerElegido) {
            return (
                '⚠️ No reconocí esa opción. Elige el *número* o escribe el *nombre* del taller:\n\n' +
                menuTalleres(talleres)
            )
        }

        return await inscribirEnTaller(jid, conv, tallerElegido)
    }

    // ── SIN ACCESO: recibir el correo ─────────────────────────
    if (conv.paso === PASO.SIN_CODIGO) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(msg)) {
            return '⚠️ Ese correo no parece válido. Escríbelo completo, ej: _tunombre@gmail.com_'
        }
        return await resolverAcceso(jid, conv, msg.toLowerCase(), waDelJid)
    }

    // ── SIN ACCESO: menú de 3 ─────────────────────────────────
    if (conv.paso === PASO.SIN_ACCESO) {
        const { correo, nombre, whatsapp } = conv

        switch (msg.trim()) {
            case '1': {
                // Ya pagó y no ve su taller → SIEMPRE reporte, nunca liberar solo.
                // Adjuntamos sus talleres para que la admin sepa cuál revisar.
                const listas   = await getListas(correo)
                const contexto = listas.length
                    ? listas.map(l => `${l.taller_nombre} (${l.estado})`).join(' · ')
                    : 'sin talleres en lista de espera'

                await reportarAcceso({
                    email:   correo,
                    nombre,
                    whatsapp,
                    motivo:  MOTIVOS.SIN_TALLER,
                    detalle: `Ya se le mostró que tiene taller activo y AUN ASÍ no lo ve. ` +
                             `Posible problema en la plataforma. Sus talleres: ${contexto}`,
                })
                conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION })
                return REPORTE_ENVIADO_TEXTO
            }

            case '2': {
                // Tiene cuenta pero no logra entrar → problema de login, lo revisa la admin
                await reportarAcceso({
                    email:   correo,
                    nombre,
                    whatsapp,
                    motivo:  MOTIVOS.SIN_PLATAFORMA,
                    detalle: 'Tiene cuenta activa pero no puede entrar. Posible problema de contraseña.',
                })
                conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION })
                return (
                    '✅ *Ya lo reportamos.*\n\n' +
                    'Vamos a revisar tu cuenta y te escribimos por aquí en cuanto esté lista. 🙌\n\n' +
                    '_Mientras tanto puedes intentar con "¿olvidaste tu contraseña?" en ' +
                    '*destello.courses/login*._\n\n' +
                    POST_ACCION_TEXTO
                )
            }

            case '3':
                conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.MENU, esNuevo: false })
                return MENU_TEXTO()

            default:
                return SIN_ACCESO_MENU
        }
    }

    // ── POST ACCIÓN ───────────────────────────────────────────
    if (conv.paso === PASO.POST_ACCION) {
        const resp = msg.toLowerCase().trim()

        if (['1', 'menu', 'menú', 'volver'].includes(resp)) {
            conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.MENU, esNuevo: false })
            return MENU_TEXTO()
        }

        if (['2', 'salir', 'no', 'adios', 'adiós'].includes(resp)) {
            conversaciones.delete(jid)
            return ADIOS_TEXTO
        }

        return POST_ACCION_TEXTO
    }

    // Fallback
    conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
    return MENU_TEXTO()
}
