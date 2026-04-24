/**
 * Destello — Faro 🌟
 * Bot de WhatsApp. Guía a los alumnos desde el primer contacto.
 *
 * MENÚ PRINCIPAL
 *   1. Registrarme a un taller
 *   2. Ver talleres disponibles
 *   3. No me llegó mi chispa o resplandor
 *   4. Medios de pago
 *   5. Tengo una duda
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
    MENU:              'MENU',
    // Flujo registro
    REG_TIPO:          'REG_TIPO',
    REG_CORREO_PERFIL: 'REG_CORREO_PERFIL',
    REG_NOMBRE:        'REG_NOMBRE',
    REG_APELLIDO:      'REG_APELLIDO',   // ← nuevo: separar nombre y apellido
    REG_CORREO_NUEVO:  'REG_CORREO_NUEVO',
    REG_TALLER:        'REG_TALLER',
    // Sin código
    SIN_CODIGO:        'SIN_CODIGO',
    // Después de completar cualquier flujo
    POST_ACCION:       'POST_ACCION',
}

/**
 * Extrae el número de teléfono local (10 dígitos) del JID de WhatsApp.
 * WhatsApp México usa dos formatos posibles:
 *   "521XXXXXXXXXX@s.whatsapp.net" → 52 (país) + 1 (celular) + 10 dígitos = 13 chars
 *   "52XXXXXXXXXX@s.whatsapp.net"  → 52 (país) + 10 dígitos = 12 chars (formato antiguo)
 * Ambos casos deben devolver los 10 dígitos locales.
 */
function extractWhatsapp(jid) {
    const raw = jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
    // Caso moderno: 52 (país) + 1 (celular) + 10 dígitos = 13 chars → quitar "521"
    if (raw.startsWith('521') && raw.length === 13) return raw.slice(3)
    // Caso antiguo: 52 (país) + 10 dígitos = 12 chars → quitar "52"
    if (raw.startsWith('52') && raw.length === 12) return raw.slice(2)
    return raw
}

const conversaciones = new Map()

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

async function registrarUsuario({ email, nombre, whatsapp }) {
    try {
        const res = await fetch(`${API_URL}/bot/registrar`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, nombre, whatsapp }),
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

async function getPendientes(email) {
    try {
        const res  = await fetch(`${API_URL}/bot/pendientes/${encodeURIComponent(email)}`)
        const data = await res.json()
        return data
    } catch { return { chispas: [], resplandores: [] } }
}

// ── Textos reutilizables ──────────────────────────────────────

const MENU_TEXTO = (nombre = '') =>
    `${nombre ? `Hola de nuevo, *${nombre.split(' ')[0]}*! 👋\n\n` : ''}` +
    '¿En qué puedo ayudarte?\n\n' +
    '1️⃣  Quiero registrarme a un taller\n' +
    '2️⃣  Ver talleres disponibles\n' +
    '3️⃣  No me llegó mi chispa o resplandor\n' +
    '4️⃣  Medios de pago\n' +
    '5️⃣  Tengo una duda'

const POST_ACCION_TEXTO =
    '¿Puedo ayudarte con algo más?\n\n' +
    '1️⃣  Volver al menú\n' +
    '2️⃣  Salir'

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
    '3️⃣  No me llegó mi chispa o resplandor\n' +
    '4️⃣  Medios de pago\n' +
    '5️⃣  Tengo una duda'

function menuTalleres(talleres) {
    if (!talleres.length) {
        return '😔 Por el momento no hay talleres disponibles. ¡Pronto abriremos nuevas fechas! Escribe *menu* para volver.'
    }
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
    return (
        '*Talleres disponibles:*\n\n' +
        talleres.map((t, i) => {
            const precio  = t.precio > 0 ? `  💰 $${t.precio} MXN` : ''
            const horario = t.horario    ? `  🕐 ${t.horario}`     : ''
            return `${emojis[i]}  *${t.nombre}*${precio}${horario}`
        }).join('\n\n')
    )
}

// ── Procesador principal ──────────────────────────────────────

export async function procesarMensaje(jid, texto) {
    const msg  = texto.trim()
    const conv = conversaciones.get(jid) || { paso: PASO.MENU, esNuevo: true }

    // "menu" o "cancelar" reinician siempre
    if (['menu', 'menú', 'cancelar', 'inicio'].includes(msg.toLowerCase())) {
        conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
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
                conversaciones.set(jid, { paso: PASO.REG_TIPO })
                return (
                    '¡Perfecto! Primero dime:\n\n' +
                    '¿Ya tienes un perfil en Destello?\n\n' +
                    '1️⃣  Sí, ya tengo perfil\n' +
                    '2️⃣  No, soy nuevo/a'
                )

            case '2': {
                const talleres = await getTalleresActivos()
                conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
                return menuTalleres(talleres) + '\n\n_Escribe *menu* para volver._'
            }

            case '3':
                conversaciones.set(jid, { paso: PASO.SIN_CODIGO })
                return (
                    'Entendido, te ayudo a revisarlo. 🔍\n\n' +
                    '¿Cuál es el correo con el que te registraste?'
                )

            case '4':
                conversaciones.set(jid, { paso: PASO.POST_ACCION })
                return PAGO_TEXTO + '\n\n' + POST_ACCION_TEXTO

            case '5':
                conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
                return (
                    '💬 *¿Tienes una duda?*\n\n' +
                    'Próximamente tendremos una sección de preguntas frecuentes.\n\n' +
                    'Por ahora escríbenos tu duda aquí y te respondemos a la brevedad. 😊\n\n' +
                    '_Escribe *menu* para volver._'
                )

            default:
                return MENU_TEXTO()
        }
    }

    // ── REGISTRO: ¿tienes perfil? ─────────────────────────────
    if (conv.paso === PASO.REG_TIPO) {
        const resp = msg.toLowerCase()

        if (['1', 'si', 'sí', 'yes'].includes(resp)) {
            conversaciones.set(jid, { ...conv, paso: PASO.REG_CORREO_PERFIL })
            return '¿Cuál es el correo con el que te registraste?'
        }

        if (['2', 'no'].includes(resp)) {
            conversaciones.set(jid, { ...conv, paso: PASO.REG_NOMBRE })
            return (
                '¡Bienvenido/a! 🎉\n\n' +
                '¿Cuál es tu *nombre*?\n\n' +
                '_Lo usamos para personalizar tus diplomas._'
            )
        }

        return (
            'Por favor elige una opción:\n\n' +
            '1️⃣  Sí, ya tengo perfil\n' +
            '2️⃣  No, soy nuevo/a'
        )
    }

    // ── REGISTRO: correo de usuario con perfil ────────────────
    if (conv.paso === PASO.REG_CORREO_PERFIL) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(msg)) {
            return '⚠️ Ese correo no parece válido. Escríbelo completo, ej: _tunombre@gmail.com_'
        }

        const { existe, usuario } = await buscarUsuario(msg)

        if (!existe) {
            // No está en la BD — ofrecemos registrarlo
            conversaciones.set(jid, { ...conv, paso: PASO.REG_NOMBRE, correo: msg })
            return (
                `⚠️ No encontramos ningún perfil con *${msg}*.\n\n` +
                '¿Deseas registrarte como nuevo/a alumno/a?\n\n' +
                '1️⃣  Sí, quiero registrarme\n' +
                '2️⃣  No, volver al menú'
            )
        }

        if (usuario.estado === 'espera') {
            conversaciones.set(jid, { paso: PASO.POST_ACCION })
            return (
                `Hola *${usuario.nombre}* 👋\n\n` +
                'Tu registro está en proceso. Aún no has activado tu perfil con tu *resplandor*.\n\n' +
                'Revisa tu correo — si no lo encuentras escríbeme con la opción 3️⃣ del menú y lo revisamos.\n\n' +
                POST_ACCION_TEXTO
            )
        }

        // Usuario activo — mostrar talleres
        const talleres = await getTalleresActivos()
        conversaciones.set(jid, {
            ...conv,
            paso:     PASO.REG_TALLER,
            correo:   msg,
            nombre:   usuario.nombre,
            talleres,
            tienePerfil: true,
        })
        return (
            `¡Hola de nuevo, *${usuario.nombre?.split(' ')[0]}*! 😊\n\n` +
            '¿A qué taller deseas registrarte?\n\n' +
            menuTalleres(talleres)
        )
    }

    // ── REGISTRO: nombre (primer paso) ────────────────────────
    if (conv.paso === PASO.REG_NOMBRE) {
        // Caso: venía del flujo "sí tengo perfil" pero no lo encontramos
        // → primero preguntamos si quiere registrarse
        if (conv.correo && !conv.preguntarNombre) {
            if (['1', 'si', 'sí'].includes(msg.toLowerCase())) {
                conversaciones.set(jid, { ...conv, paso: PASO.REG_NOMBRE, preguntarNombre: true })
                return '¿Cuál es tu *nombre*?\n\n_Lo usamos para personalizar tus diplomas._'
            }
            if (['2', 'no'].includes(msg.toLowerCase())) {
                conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
                return MENU_TEXTO()
            }
        }

        // Recibió el nombre — ahora pedir apellido
        conversaciones.set(jid, { ...conv, paso: PASO.REG_APELLIDO, nombre: msg.trim() })
        return (
            `Hola, *${msg.trim()}*! 😊\n\n` +
            '¿Cuál es tu *apellido*?\n\n' +
            '_Lo necesitamos para tu certificado._'
        )
    }

    // ── REGISTRO: apellido (segundo paso) ─────────────────────
    if (conv.paso === PASO.REG_APELLIDO) {
        const nombreCompleto = `${conv.nombre} ${msg.trim()}`
        conversaciones.set(jid, { ...conv, paso: PASO.REG_CORREO_NUEVO, nombre: nombreCompleto })
        return (
            `Perfecto, *${conv.nombre}*! 👍\n\n` +
            '¿Cuál es tu *correo electrónico*?\n\n' +
            '_Tu perfil en Destello se vincula a tu correo._'
        )
    }

    // ── REGISTRO: correo de usuario nuevo ────────────────────
    if (conv.paso === PASO.REG_CORREO_NUEVO) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(msg)) {
            return '⚠️ Ese correo no parece válido. Escríbelo completo, ej: _tunombre@gmail.com_'
        }

        // Verificar si ya existe
        const { existe, usuario } = await buscarUsuario(msg)

        if (existe && usuario.estado === 'activo') {
            const talleres = await getTalleresActivos()
            conversaciones.set(jid, {
                ...conv,
                paso:     PASO.REG_TALLER,
                correo:   msg,
                nombre:   usuario.nombre,
                talleres,
                tienePerfil: true,
            })
            return (
                `¡Encontramos tu perfil, *${usuario.nombre?.split(' ')[0]}*! 👋\n\n` +
                'Te muestro los talleres disponibles:\n\n' +
                menuTalleres(talleres)
            )
        }

        // Guardar usuario nuevo
        const whatsapp = extractWhatsapp(jid)
        await registrarUsuario({ email: msg, nombre: conv.nombre, whatsapp })

        const talleres = await getTalleresActivos()
        conversaciones.set(jid, {
            ...conv,
            paso:     PASO.REG_TALLER,
            correo:   msg,
            talleres,
            tienePerfil: false,
        })
        return (
            '✅ *¡Registro guardado!*\n\n' +
            '¿A qué taller deseas registrarte en la lista de espera?\n\n' +
            menuTalleres(talleres)
        )
    }

    // ── REGISTRO: selección de taller ────────────────────────
    if (conv.paso === PASO.REG_TALLER) {
        const { talleres = [], nombre, correo, tienePerfil } = conv

        if (!talleres.length) {
            conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
            return '😔 No hay talleres disponibles en este momento.\n\n' + MENU_TEXTO()
        }

        // Buscar por número o nombre
        const input = msg.toLowerCase().trim()
        let tallerElegido = null

        const num = parseInt(input)
        if (!isNaN(num) && num >= 1 && num <= talleres.length) {
            tallerElegido = talleres[num - 1]
        }
        if (!tallerElegido) {
            tallerElegido = talleres.find(t =>
                t.nombre.toLowerCase().includes(input)
            )
        }

        if (!tallerElegido) {
            return (
                '⚠️ No reconocí esa opción. Elige el *número* o escribe el *nombre* del taller:\n\n' +
                menuTalleres(talleres)
            )
        }

        // Registrar en lista de espera
        const whatsapp  = extractWhatsapp(jid)
        const resultado = await agregarALista({
            email:    correo,
            tallerId: tallerElegido.id,
            nombre,
            whatsapp,
        })

        conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })

        conversaciones.set(jid, { paso: PASO.POST_ACCION })

        if (!resultado.nuevo) {
            return (
                `ℹ️ *${nombre?.split(' ')[0] || 'Hola'}*, ya estás en la lista de espera de *${tallerElegido.nombre}*.\n\n` +
                'Te avisaremos en cuanto haya un lugar disponible. 🙌\n\n' +
                POST_ACCION_TEXTO
            )
        }

        if (tienePerfil) {
            return (
                `🎉 *¡Listo!* Quedaste registrado/a en la lista de espera de:\n\n` +
                `📚 *${tallerElegido.nombre}*\n\n` +
                'Te notificaremos aquí y por correo cuando confirmemos tu cupo. ¡Estás muy cerca! ✨\n\n' +
                POST_ACCION_TEXTO
            )
        }

        return (
            `🎉 *¡Registro completado!*\n\n` +
            `Quedaste en la lista de espera de:\n📚 *${tallerElegido.nombre}*\n\n` +
            '📬 Te notificaremos por correo si alcanzaste lugar. En caso de que sí, ' +
            'recibirás tu *resplandor* para crear tu perfil en Destello.\n\n' +
            '_¡Mantente pendiente!_ 🌟\n\n' +
            POST_ACCION_TEXTO
        )
    }

    // ── SIN CÓDIGO: buscar por correo ─────────────────────────
    if (conv.paso === PASO.SIN_CODIGO) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(msg)) {
            return '⚠️ Ese correo no parece válido. Escríbelo completo, ej: _tunombre@gmail.com_'
        }

        const pendientes = await getPendientes(msg)
        conversaciones.set(jid, { paso: PASO.POST_ACCION })

        if (pendientes.chispas?.length > 0) {
            const lista = pendientes.chispas.map(c => `• *${c.taller_nombre}*: \`${c.code}\``).join('\n')
            return (
                '✅ Encontramos tu(s) código(s):\n\n' +
                lista + '\n\n' +
                '📱 Úsalos en: *destello.courses/acceso*\n\n' +
                POST_ACCION_TEXTO
            )
        }

        if (pendientes.resplandores?.length > 0) {
            return (
                '✉️ Tu *resplandor* fue enviado a ese correo.\n\n' +
                'Por favor revisa también tu carpeta de *spam o correo no deseado*.\n\n' +
                'Si sigues sin encontrarlo, escríbenos y lo revisamos. 😊\n\n' +
                POST_ACCION_TEXTO
            )
        }

        return (
            `🔍 No encontramos códigos pendientes para *${msg}*.\n\n` +
            'Puede que aún no hayas sido seleccionado/a o que tu pago esté en proceso de verificación.\n\n' +
            POST_ACCION_TEXTO
        )
    }

    // ── POST ACCIÓN: ¿volver al menú o salir? ────────────────
    if (conv.paso === PASO.POST_ACCION) {
        const resp = msg.toLowerCase().trim()

        if (['1', 'menu', 'menú', 'volver'].includes(resp)) {
            conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
            return MENU_TEXTO()
        }

        if (['2', 'salir', 'no', 'adios', 'adiós'].includes(resp)) {
            conversaciones.delete(jid)
            return ADIOS_TEXTO
        }

        return POST_ACCION_TEXTO
    }

    // Fallback — mostrar menú
    conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
    return MENU_TEXTO()
}