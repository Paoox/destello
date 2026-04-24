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
 *
 * FLUJO REGISTRO — opción 1 del menú:
 *   → REG_CORREO   (pedir email)
 *     ├── email existe → REG_TALLER  (usar datos existentes, sin preguntar nada más)
 *     └── email nuevo  → REG_NOMBRE → REG_APELLIDO → [registrar] → REG_TALLER
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
    REG_WHATSAPP: 'REG_WHATSAPP', // pedir número cuando el JID es @lid
    REG_TALLER:   'REG_TALLER',
    // Sin código
    SIN_CODIGO:   'SIN_CODIGO',
    // Después de completar cualquier flujo
    POST_ACCION:  'POST_ACCION',
}

/**
 * Extrae el número de teléfono local (10 dígitos) del JID de WhatsApp.
 *   "521XXXXXXXXXX@s.whatsapp.net" → 13 dígitos → quitar "521" → 10 locales
 *   "52XXXXXXXXXX@s.whatsapp.net"  → 12 dígitos → quitar "52"  → 10 locales
 *   "XXXXXXXXXXXXXXX@lid"          → ID interno de WA, NO extraíble → devuelve null
 */
function extractWhatsapp(jid) {
    if (!jid || jid.includes('@lid')) return null
    const raw = jid.replace('@s.whatsapp.net', '').replace('@c.us', '')
    if (raw.startsWith('521') && raw.length === 13) return raw.slice(3)
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

const VER_TALLERES_OPCIONES =
    '─────────────────────\n' +
    '¿Qué te gustaría hacer?\n\n' +
    '1️⃣  Registrarme a la lista de espera\n' +
    '2️⃣  Volver al menú\n' +
    '3️⃣  Salir'

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

function fmtFecha(iso) {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d)) return null
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

function menuTalleres(talleres) {
    if (!talleres.length) {
        return '😔 Por el momento no hay talleres disponibles. ¡Pronto abriremos nuevas fechas!'
    }
    const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣']
    return (
        '*Talleres disponibles:*\n\n' +
        talleres.map((t, i) => {
            const precio  = t.precio > 0 ? `\n   💰 $${Number(t.precio).toLocaleString('es-MX')} MXN` : '\n   💰 Gratis'
            const horario = t.horario     ? `\n   🕐 ${t.horario}` : ''
            const fecha   = fmtFecha(t.fecha_inicio) ? `\n   📅 ${fmtFecha(t.fecha_inicio)}` : ''
            const prox    = t.estado === 'proximamente' ? ' _(Próximamente)_' : ''
            return `${emojis[i]}  *${t.nombre}*${prox}${precio}${horario}${fecha}`
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
                    conversaciones.set(jid, { paso: PASO.POST_ACCION })
                    return (
                        '😔 Por el momento no hay talleres disponibles. ¡Pronto abriremos nuevas fechas!\n\n' +
                        POST_ACCION_TEXTO
                    )
                }
                conversaciones.set(jid, { paso: PASO.VER_TALLERES, talleres })
                return menuTalleres(talleres) + '\n\n' + VER_TALLERES_OPCIONES
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
                conversaciones.set(jid, { paso: PASO.POST_ACCION })
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

    // ── VER TALLERES: opciones post-lista ─────────────────────
    if (conv.paso === PASO.VER_TALLERES) {
        switch (msg.trim()) {
            case '1':
                conversaciones.set(jid, { paso: PASO.REG_CORREO })
                return (
                    '¡Perfecto! 😊\n\n' +
                    '¿Cuál es tu *correo electrónico*?'
                )

            case '2':
                conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
                return MENU_TEXTO()

            case '3':
                conversaciones.delete(jid)
                return ADIOS_TEXTO

            default:
                return VER_TALLERES_OPCIONES
        }
    }

    // ── REGISTRO: correo (punto de entrada unificado) ─────────
    //   - Usuario existe (activo o espera) → taller directo
    //   - Usuario nuevo → pedir nombre y apellido, luego registrar
    if (conv.paso === PASO.REG_CORREO) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(msg)) {
            return '⚠️ Ese correo no parece válido. Escríbelo completo, ej: _tunombre@gmail.com_'
        }

        const { existe, usuario } = await buscarUsuario(msg)

        if (existe) {
            const talleres = await getTalleresActivos()

            if (!talleres.length) {
                conversaciones.set(jid, { paso: PASO.POST_ACCION })
                return (
                    `Hola *${usuario.nombre?.split(' ')[0]}* 👋\n\n` +
                    '😔 No hay talleres disponibles por el momento.\n\n' +
                    POST_ACCION_TEXTO
                )
            }

            conversaciones.set(jid, {
                ...conv,
                paso:        PASO.REG_TALLER,
                correo:      msg,
                nombre:      usuario.nombre,
                whatsapp:    usuario.whatsapp ?? null,
                talleres,
                tienePerfil: usuario.estado === 'activo',
            })

            if (usuario.estado === 'espera') {
                return (
                    `¡Te reconocí, *${usuario.nombre?.split(' ')[0]}*! 👋\n\n` +
                    '¿A qué taller te quieres inscribir?\n\n' +
                    menuTalleres(talleres)
                )
            }

            return (
                `¡Hola de nuevo, *${usuario.nombre?.split(' ')[0]}*! 😊\n\n` +
                '¿A qué taller te quieres inscribir?\n\n' +
                menuTalleres(talleres)
            )
        }

        // No existe → pedir nombre
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

    // ── REGISTRO: apellido → registrar usuario ────────────────
    if (conv.paso === PASO.REG_APELLIDO) {
        const nombreCompleto = `${conv.nombre} ${msg.trim()}`
        const whatsapp       = extractWhatsapp(jid)

        // Registrar usuario en la BD
        await registrarUsuario({ email: conv.correo, nombre: nombreCompleto, whatsapp })

        // Si el JID es @lid no pudimos sacar el número → pedirlo
        if (!whatsapp) {
            conversaciones.set(jid, { ...conv, paso: PASO.REG_WHATSAPP, nombre: nombreCompleto })
            return (
                '✅ *¡Datos guardados!*\n\n' +
                'Para poder contactarte, ¿cuál es tu número de WhatsApp de *10 dígitos*?\n\n' +
                '_Ejemplo: 5512345678_'
            )
        }

        const talleres = await getTalleresActivos()

        if (!talleres.length) {
            conversaciones.set(jid, { paso: PASO.POST_ACCION })
            return (
                '✅ *¡Registro guardado!*\n\n' +
                '😔 Por el momento no hay talleres disponibles, pero cuando abran nuevas fechas puedes volver a escribirme.\n\n' +
                POST_ACCION_TEXTO
            )
        }

        conversaciones.set(jid, {
            ...conv,
            paso:        PASO.REG_TALLER,
            nombre:      nombreCompleto,
            whatsapp,
            talleres,
            tienePerfil: false,
        })
        return (
            '✅ *¡Registro guardado!*\n\n' +
            '¿A qué taller te quieres inscribir?\n\n' +
            menuTalleres(talleres)
        )
    }

    // ── REGISTRO: número de WhatsApp (cuando JID es @lid) ────
    if (conv.paso === PASO.REG_WHATSAPP) {
        const numero = msg.replace(/\D/g, '')
        if (numero.length !== 10) {
            return (
                '⚠️ El número debe tener exactamente *10 dígitos*.\n\n' +
                'Escríbelo sin espacios ni guiones, ej: _5512345678_'
            )
        }

        await registrarUsuario({ email: conv.correo, nombre: conv.nombre, whatsapp: numero })

        const talleres = await getTalleresActivos()

        if (!talleres.length) {
            conversaciones.set(jid, { paso: PASO.POST_ACCION })
            return (
                '✅ *¡Listo!* 📱\n\n' +
                '😔 Por el momento no hay talleres disponibles, pero cuando abran nuevas fechas puedes volver.\n\n' +
                POST_ACCION_TEXTO
            )
        }

        conversaciones.set(jid, {
            ...conv,
            paso:        PASO.REG_TALLER,
            whatsapp:    numero,
            talleres,
            tienePerfil: false,
        })
        return (
            '¡Listo! 📱\n\n' +
            '¿A qué taller te quieres inscribir?\n\n' +
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

        const input = msg.toLowerCase().trim()
        let tallerElegido = null

        const num = parseInt(input)
        if (!isNaN(num) && num >= 1 && num <= talleres.length) {
            tallerElegido = talleres[num - 1]
        }
        if (!tallerElegido) {
            tallerElegido = talleres.find(t => t.nombre.toLowerCase().includes(input))
        }

        if (!tallerElegido) {
            return (
                '⚠️ No reconocí esa opción. Elige el *número* o escribe el *nombre* del taller:\n\n' +
                menuTalleres(talleres)
            )
        }

        const whatsapp  = conv.whatsapp || extractWhatsapp(jid)
        const resultado = await agregarALista({
            email:    correo,
            tallerId: tallerElegido.id,
            nombre,
            whatsapp,
        })

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

    // ── POST ACCIÓN ───────────────────────────────────────────
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

    // Fallback
    conversaciones.set(jid, { paso: PASO.MENU, esNuevo: false })
    return MENU_TEXTO()
}