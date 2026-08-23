/**
 * Destello — Faro 🌟
 * Bot de WhatsApp. Guía a los alumnos desde el primer contacto.
 *
 * MENÚ PRINCIPAL
 *   1. Registrarme a un taller
 *   2. Ver talleres disponibles
 *   3. No me llegó mi acceso  (diagnostica por correo y resuelve lo que puede)
 *   4. Medios de pago
 *   5. Ya pague, quiero reportarlo
 *   6. Tengo una duda
 *
 * FLUJO REGISTRO — opción 1 del menú:
 *   → REG_CORREO   (pedir email)
 *     ├── email existe → [si falta WA → REG_WHATSAPP] → REG_TALLER
 *     └── email nuevo  → REG_NOMBRE (completo, 1 mensaje) → [REG_WHATSAPP si @lid] → REG_TALLER
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
    REG_WHATSAPP: 'REG_WHATSAPP', // pedir número cuando no se pudo extraer del JID
    REG_TALLER:   'REG_TALLER',
    // Sin acceso (opción 3)
    SIN_CODIGO:   'SIN_CODIGO',   // pedir correo
    SIN_ACCESO:   'SIN_ACCESO',   // escalamiento cuando lo resuelto no le sirvió
    // Reportar pago (opción 6)
    PAGO_CORREO:  'PAGO_CORREO',  // pedir correo si no lo tenemos en la conversación
    PAGO_COMO:    'PAGO_COMO',    // ¿foto o datos escritos?
    PAGO_FOTO:    'PAGO_FOTO',    // esperando el imageMessage — lo atiende index.js
    PAGO_BANCO:   'PAGO_BANCO',
    PAGO_MONTO:   'PAGO_MONTO',
    PAGO_TITULAR: 'PAGO_TITULAR',
    PAGO_FECHA:   'PAGO_FECHA',
    PAGO_FOLIO:   'PAGO_FOLIO',
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

// ── Estado de las conversaciones ──────────────────────────────
//
// Antes esto era un `Map()` a secas. Problema: **cada reinicio del bot borraba
// todas las conversaciones a medias.** Le pedías el correo a alguien, mientras
// tanto se reiniciaba el bot, y su siguiente mensaje caía en el vacío — el bot
// ya no sabía quién era ni qué estaba haciendo. Eso ya estaba pasando.
//
// Ahora el Map sigue siendo la memoria rápida (leer de RAM es instantáneo y el
// bot responde igual de rápido), pero cada cambio se escribe también en la BD
// por HTTP, sin await: si la API tarda, la persona no espera. Al arrancar en
// frío, `procesarMensaje` rehidrata la conversación desde la BD.
//
// De paso, eso vuelve medible el embudo del bot: cuántos empiezan, en qué paso
// se caen y cuántos terminan inscritos.
//
// La forma (get/set/has/delete) es idéntica a la de un Map a propósito, para
// que ninguna de las ~30 llamadas que ya existían tuviera que cambiar.
const _memoria = new Map()

/** Escribe el estado en la BD. Nunca bloquea ni lanza: es solo memoria. */
function persistir(jid, conv) {
    const datos = conv ? { ...conv } : {}
    // El listado de talleres se recarga solo en cada mensaje; guardarlo sería
    // ocupar espacio con algo que caduca enseguida.
    delete datos.talleres
    fetch(`${API_URL}/bot/conversacion/${encodeURIComponent(jid)}`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            whatsapp:   conv?.whatsapp ?? null,
            email:      conv?.correo   ?? null,
            paso:       conv?.paso     ?? null,
            datos,
            completada: !!conv?.completada,
        }),
    }).catch(() => { /* la medición nunca debe estorbarle a la conversación */ })
}

const conversaciones = {
    get:    (jid) => _memoria.get(jid),
    has:    (jid) => _memoria.has(jid),
    set:    (jid, conv) => { _memoria.set(jid, conv); persistir(jid, conv); return conversaciones },
    delete: (jid) => { _memoria.delete(jid); persistir(jid, null); return true },
}

/** Rehidrata una conversación tras un reinicio del bot. Silencioso si falla. */
async function restaurarConversacion(jid) {
    try {
        const res  = await fetch(`${API_URL}/bot/conversacion/${encodeURIComponent(jid)}`)
        const data = await res.json()
        const c    = data?.conversacion
        if (!c || !c.paso) return null
        return { ...(c.datos || {}), paso: c.paso, esNuevo: false }
    } catch { return null }
}

/** Deja un renglón en la bitácora. Sin await, nunca estorba. */
function registrarEvento(tipo, { email = null, tallerId = null, ...metadata } = {}) {
    fetch(`${API_URL}/bot/evento`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tipo, email, tallerId, metadata }),
    }).catch(() => {})
}

/**
 * Datos del alumno que se conservan al cambiar de flujo dentro de la MISMA
 * conversación, para no volver a preguntarle el correo. Deja fuera el estado
 * temporal (talleres cargados, taller preseleccionado) que sí debe limpiarse.
 */
function datosUsuario(conv = {}) {
    const { correo, nombre, apellido, whatsapp, tienePerfil } = conv
    return { correo, nombre, apellido, whatsapp, tienePerfil }
}

/**
 * Horas que le quedan para pagar sin perder el lugar.
 *
 * Son 48 h desde que se le confirmó el cupo — el mismo plazo que muestra el
 * panel de admin. Se calcula aquí y no se guarda: la fecha de confirmación es
 * el dato real, el reloj es solo una lectura de esa fecha.
 *
 * @returns {number|null} horas restantes (negativo si ya venció), o null si no
 *                        hay fecha de confirmación con la cual contar.
 */
function horasParaPagar(confirmadoAt) {
    if (!confirmadoAt) return null
    const transcurridas = (Date.now() - new Date(confirmadoAt).getTime()) / 3_600_000
    return Math.round(48 - transcurridas)
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

/**
 * Reporta un pago para que la admin lo coteje contra el banco.
 * NO activa la cuenta ni asigna talleres: el bot nunca decide sobre dinero.
 */
async function reportarPago({ email, nombre, whatsapp, tipo, datos, comprobanteBase64, comprobanteMime }) {
    try {
        const res = await fetch(`${API_URL}/bot/reporte-pago`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({
                email, nombre, whatsapp, tipo, datos,
                comprobanteBase64, comprobanteMime,
            }),
        })
        return await res.json()
    } catch { return { status: 'error' } }
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
    '5️⃣  Ya pagué, quiero reportarlo\n' +
    '6️⃣  Tengo una duda'

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
    '5️⃣  Ya pagué, quiero reportarlo\n' +
    '6️⃣  Tengo una duda'

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

// ── Textos del reporte de pago (opción 5) ─────────────────────

const PAGO_PEDIR_CORREO_TEXTO =
    '💰 *Reportar mi pago*\n\n' +
    'Para ligarlo con tu registro, ¿cuál es tu *correo*?\n\n' +
    '_El mismo con el que te inscribiste._'

const PAGO_COMO_TEXTO =
    '💰 *Reportar mi pago*\n\n' +
    '¿Cómo prefieres mandármelo?\n\n' +
    '1️⃣  Enviar foto de mi comprobante\n' +
    '2️⃣  Escribir los datos de mi pago\n\n' +
    '_O escribe *menu* para volver._'

const PAGO_ESPERA_FOTO_TEXTO =
    '📸 Va, mándame la *foto de tu comprobante* aquí mismo.\n\n' +
    'Puede ser la captura de la transferencia o la foto del ticket del depósito.\n\n' +
    '_Si prefieres escribir los datos, escribe *2*._'

/**
 * Cierre único para los dos caminos (foto y datos escritos).
 *
 * Es deliberadamente claro en que NO se activa nada todavía: la persona debe
 * quedarse esperando la confirmación, no creyendo que ya tiene acceso. Prometer
 * acceso inmediato aquí generaría un segundo reporte cuando no lo vea.
 */
const PAGO_RECIBIDO_TEXTO =
    '✅ *Ya lo recibimos.*\n\n' +
    'Lo revisamos contra el banco y te notificamos por aquí en cuanto quede ' +
    'reflejado tu pago. 🙌\n\n' +
    '_Todavía no se activa tu acceso: primero confirmamos que el pago haya caído._\n\n' +
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
            // Un taller agotado se sigue mostrando (sirve de prueba social y
            // para avisarle de la próxima fecha), pero se dice de una vez para
            // que nadie se ilusione y luego se lleve el "no hay lugar".
            const lleno   = (t.agotado || t.estado === 'lleno') ? ' 🔴 _AGOTADO_' : ''
            // Últimos lugares: sin inventar urgencia, solo el dato real.
            const pocos   = (!t.agotado && t.lugares_libres > 0 && t.lugares_libres <= 3)
                ? `\n   ⚡ Últimos ${t.lugares_libres} lugares` : ''
            return `${numeroLista(i)}  *${t.nombre}*${prox}${lleno}${precio}${horario}${fecha}${pocos}`
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

    // `completada: true` marca que esta conversación llegó hasta el final. Es
    // el numerador del embudo del bot: de todos los que empiezan, cuántos
    // terminan realmente inscritos en un taller.
    //
    // ⚠️ Se conserva `datosUsuario(conv)`. Antes se perdía todo aquí, así que
    // después de inscribirse el bot olvidaba quién era y le volvía a pedir el
    // correo en el siguiente flujo — a alguien que se lo acababa de dar.
    conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION, completada: true })

    if (resultado.status === 'error') {
        return (
            '😕 Tuvimos un problema al guardar tu registro. Intenta de nuevo en un momento, por favor.\n\n' +
            POST_ACCION_TEXTO
        )
    }

    const primerNombre = nombre?.split(' ')[0] || 'Hola'

    // El taller se llenó. Puede pasar entre que vio la lista y eligió: alguien
    // más alcanzó el último lugar en esos segundos. Se le dice claro y se le
    // ofrece la única salida real, que es avisarle de la próxima fecha.
    if (resultado.sinCupo) {
        return (
            `😔 *${primerNombre}*, *${taller.nombre}* acaba de llenarse.\n\n` +
            'Los talleres son en vivo y con cupo limitado para que todas puedan ' +
            'participar de verdad, así que ya no podemos apartar más lugares.\n\n' +
            '✨ Escríbenos por aquí y te avisamos *en cuanto abramos la siguiente fecha*.\n\n' +
            POST_ACCION_TEXTO
        )
    }

    // Ya tiene acceso a ese taller: no está esperando nada, ya está adentro.
    // Decirle "te avisamos cuando haya lugar" sería confundirla — y volver a
    // formarla ocuparía DOS lugares del mismo taller, cuando la regla es una
    // cuenta = un lugar (cada quien necesita la suya para tomar la clase,
    // aunque sean de la misma familia).
    if (resultado.yaTieneAcceso) {
        return (
            `✨ *${primerNombre}*, ya tienes acceso a *${taller.nombre}*.\n\n` +
            'No necesitas volver a inscribirte: entra a la plataforma y ahí lo ' +
            'encuentras listo.\n\n' +
            '👉 https://destello.courses/login\n\n' +
            '_Entra con Google o con tu número._\n\n' +
            POST_ACCION_TEXTO
        )
    }

    // Ya tenía renglón en la lista. Antes aquí se le decía a TODOS lo mismo:
    // "te avisaremos cuando haya lugar". Eso está mal para quien ya tiene su
    // lugar apartado y lo único que falta es que pague — a esa persona no hay
    // que decirle que espere, hay que decirle cómo pagar y cuánto tiempo tiene.
    if (!resultado.nuevo) {
        const estado = resultado.registro?.estado

        if (estado === 'pagado') {
            return (
                `✅ *${primerNombre}*, tu pago de *${taller.nombre}* ya está confirmado.\n\n` +
                'No tienes que hacer nada más: entra a la plataforma y ahí lo encuentras.\n\n' +
                '👉 https://destello.courses/login\n\n' +
                '_Entra con Google o con tu número._\n\n' +
                POST_ACCION_TEXTO
            )
        }

        if (estado === 'cupo_confirmado' || estado === 'confirmado') {
            const restante = horasParaPagar(resultado.registro?.confirmado_at)
            const reloj = restante == null
                ? ''
                : restante > 0
                    ? `⏳ Te quedan *${restante} h* para completarlo sin perder tu lugar.\n\n`
                    : '⚠️ El plazo para apartarlo ya venció, pero escríbenos y lo revisamos. 🙌\n\n'

            return (
                `🎟️ *${primerNombre}*, ¡ya tienes tu lugar apartado en *${taller.nombre}*!\n\n` +
                'Lo único que falta es tu pago.\n\n' +
                reloj +
                PAGO_TEXTO + '\n\n' +
                POST_ACCION_TEXTO
            )
        }

        if (estado === 'rechazado') {
            return (
                `😕 *${primerNombre}*, tu lugar en *${taller.nombre}* se liberó.\n\n` +
                'Si todavía quieres tomarlo, escríbenos y vemos si hay cupo disponible. 🙌\n\n' +
                POST_ACCION_TEXTO
            )
        }

        // 'pendiente': está formada, todavía sin lugar confirmado.
        return (
            `ℹ️ *${primerNombre}*, ya estás en la lista de espera de *${taller.nombre}*.\n\n` +
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

    // Si no está en memoria puede ser gente nueva… o alguien cuya conversación
    // se perdió porque el bot se reinició. Se intenta rescatar de la BD antes
    // de tratarla como nueva. Es el único `await` que se agregó aquí: todo lo
    // de abajo sigue siendo síncrono.
    if (!conversaciones.has(jid)) {
        const rescatada = await restaurarConversacion(jid)
        if (rescatada) _memoria.set(jid, rescatada)
    }

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
            registrarEvento('bot_conversacion_inicio', { whatsapp: waDelJid })
            return SALUDO_INICIAL
        }

        // Qué opción eligió. De aquí sale el embudo del bot: cuántos entran,
        // qué buscan y en qué punto se caen.
        if (['1','2','3','4','5','6'].includes(msg)) {
            registrarEvento('bot_menu_opcion', { email: conv.correo ?? null, opcion: msg })
        }

        switch (msg) {
            case '1':
                // Si ya dio su correo en esta conversación, no se le vuelve a
                // pedir: se va directo a elegir taller. Volver a preguntar algo
                // que la persona acaba de contestar se siente a desatención.
                if (conv.correo) {
                    return await continuarTrasDatos(jid, datosUsuario(conv), '¡Perfecto! 😊')
                }
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
                conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.VER_TALLERES, talleres })
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
                // Reportar un pago. Si ya sabemos su correo en esta conversación
                // no se lo volvemos a pedir.
                if (conv.correo) {
                    conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.PAGO_COMO })
                    return PAGO_COMO_TEXTO
                }
                conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.PAGO_CORREO })
                return PAGO_PEDIR_CORREO_TEXTO

            case '6':
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
            '¿Cuál es tu *nombre completo*?\n\n' +
            '_Así te saludamos por aquí. El nombre exacto que quieres en tu ' +
            'certificado lo eliges después, desde tu perfil._'
        )
    }

    // ── REGISTRO: nombre ──────────────────────────────────────
    // ── REGISTRO: nombre completo, en UN solo mensaje ─────────
    //
    // Antes eran dos pasos (nombre, luego apellido) = dos idas y vueltas más en
    // el momento donde la gente todavía se puede arrepentir. Ahora se pide una
    // sola vez y se parte aquí: primera palabra = nombre, el resto = apellido.
    //
    // Se siguen guardando en columnas SEPARADAS de `usuarios` — nunca
    // concatenados, que era el bug que metía el apellido dentro del nombre.
    //
    // Y ojo: este corte es solo una PROPUESTA para uso interno (saludarla,
    // buscarla). El nombre que va impreso en el certificado se le pregunta
    // aparte en su perfil — "¿cómo quieres que aparezca tu nombre?" — y se
    // guarda tal cual en `usuarios.nombre_certificado`. Partir nombres a la
    // fuerza es una pelea que no se gana: hay dos apellidos, nombres
    // compuestos, "de la"… mejor que lo escriba la persona.
    if (conv.paso === PASO.REG_NOMBRE) {
        const completo = msg.trim().replace(/\s+/g, ' ')
        const partes   = completo.split(' ')
        const nombre   = partes[0]
        const apellido = partes.slice(1).join(' ') || null

        const base = { ...conv, nombre, apellido, whatsapp: waDelJid, tienePerfil: false }

        // Sin número extraíble (@lid) → pedirlo ANTES de registrar en BD
        if (!waDelJid) {
            conversaciones.set(jid, { ...base, paso: PASO.REG_WHATSAPP })
            return `Gracias, *${nombre}* 🙌\n\n` + PEDIR_WHATSAPP_TEXTO
        }

        await registrarUsuario({
            email:    conv.correo,
            nombre,
            apellido,
            whatsapp: waDelJid,
        })
        registrarEvento('bot_registro_completo', { email: conv.correo, paso: 'nombre' })

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
            conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.MENU, esNuevo: false })
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

    // ── REPORTAR PAGO (opción 5) ──────────────────────────────
    //
    // Dos caminos: foto de comprobante (la atiende index.js, porque necesita el
    // socket de WhatsApp para descargar y reenviar la imagen) o datos escritos.
    // Los datos se piden UNO POR MENSAJE a propósito: pedir cinco cosas juntas
    // hace que la gente conteste tres y se pierda el resto.

    if (conv.paso === PASO.PAGO_CORREO) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(msg)) {
            return '⚠️ Ese correo no parece válido. Escríbelo completo, ej: _tunombre@gmail.com_'
        }

        // Si ya tiene perfil aprovechamos su nombre para el aviso a la admin.
        const { existe, usuario } = await buscarUsuario(msg)
        conversaciones.set(jid, {
            ...conv,
            correo:   msg,
            nombre:   conv.nombre   || (existe ? usuario.nombre   : null),
            apellido: conv.apellido || (existe ? usuario.apellido : null),
            whatsapp: conv.whatsapp || (existe ? usuario.whatsapp : null) || waDelJid,
            paso:     PASO.PAGO_COMO,
        })
        return PAGO_COMO_TEXTO
    }

    if (conv.paso === PASO.PAGO_COMO) {
        const resp = msg.trim()

        if (resp === '1') {
            conversaciones.set(jid, { ...conv, paso: PASO.PAGO_FOTO })
            return PAGO_ESPERA_FOTO_TEXTO
        }

        if (resp === '2') {
            conversaciones.set(jid, { ...conv, pago: {}, paso: PASO.PAGO_BANCO })
            return '🏦 ¿De qué *banco* saliste o en qué tienda depositaste?'
        }

        return PAGO_COMO_TEXTO
    }

    // Mientras espera la foto, la persona puede cambiar de opinión y escribirla.
    if (conv.paso === PASO.PAGO_FOTO) {
        if (msg.trim() === '2') {
            conversaciones.set(jid, { ...conv, pago: {}, paso: PASO.PAGO_BANCO })
            return '🏦 ¿De qué *banco* saliste o en qué tienda depositaste?'
        }
        return PAGO_ESPERA_FOTO_TEXTO
    }

    if (conv.paso === PASO.PAGO_BANCO) {
        conversaciones.set(jid, {
            ...conv,
            pago: { ...conv.pago, banco: msg.trim() },
            paso: PASO.PAGO_MONTO,
        })
        return '💵 ¿De cuánto fue el *monto*?'
    }

    if (conv.paso === PASO.PAGO_MONTO) {
        conversaciones.set(jid, {
            ...conv,
            pago: { ...conv.pago, monto: msg.trim() },
            paso: PASO.PAGO_TITULAR,
        })
        return '👤 ¿A nombre de quién salió el pago? (*titular* de la cuenta o tarjeta)'
    }

    if (conv.paso === PASO.PAGO_TITULAR) {
        conversaciones.set(jid, {
            ...conv,
            pago: { ...conv.pago, titular: msg.trim() },
            paso: PASO.PAGO_FECHA,
        })
        return '📅 ¿Qué *día y a qué hora* lo hiciste? (aproximado está bien)'
    }

    if (conv.paso === PASO.PAGO_FECHA) {
        conversaciones.set(jid, {
            ...conv,
            pago: { ...conv.pago, fecha: msg.trim() },
            paso: PASO.PAGO_FOLIO,
        })
        return (
            '🔢 Por último, ¿tienes el *folio* o número de referencia?\n\n' +
            '_Si no lo tienes a la mano, escribe *no*._'
        )
    }

    if (conv.paso === PASO.PAGO_FOLIO) {
        const sinFolio = ['no', 'ninguno', 'nel', 'no tengo', '-'].includes(msg.toLowerCase().trim())
        const pago = { ...conv.pago, folio: sinFolio ? null : msg.trim() }

        await reportarPago({
            email:    conv.correo,
            nombre:   nombreCompleto(conv),
            whatsapp: conv.whatsapp || waDelJid,
            tipo:     'datos',
            datos:    pago,
        })

        conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION })
        return PAGO_RECIBIDO_TEXTO
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
    conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.MENU, esNuevo: false })
    return MENU_TEXTO()
}

// ── Comprobantes (imágenes) ───────────────────────────────────
//
// La foto NO se procesa aquí: descargarla y reenviarla necesita el socket de
// Baileys, que vive en index.js. Este módulo solo aporta el estado de la
// conversación — quién está esperando mandar comprobante y con qué datos.

/** ¿Este chat está justo en el paso de mandar su comprobante? */
export function esperaComprobante(jid) {
    return conversaciones.get(jid)?.paso === PASO.PAGO_FOTO
}

/**
 * Registra el comprobante recibido y avanza la conversación.
 * Devuelve el texto para el alumno y el resumen para reenviarle a la admin
 * junto con la imagen.
 *
 * @param {string}  jid
 * @param {string?} caption texto que la persona escribió junto a la foto
 * @param {Buffer?} imagen  bytes de la foto, para guardarla en el panel
 * @param {string?} mimetype
 */
export async function registrarComprobante(jid, caption = null, imagen = null, mimetype = null) {
    const conv = conversaciones.get(jid) || {}

    await reportarPago({
        email:    conv.correo,
        nombre:   nombreCompleto(conv),
        whatsapp: conv.whatsapp || extractWhatsapp(jid),
        tipo:     'comprobante',
        datos:    caption ? { folio: caption } : null,
        // La imagen viaja en base64 para que la API la suba a Supabase Storage y
        // quede visible en la bandeja del panel, no solo en el chat de WhatsApp.
        comprobanteBase64: imagen ? imagen.toString('base64') : undefined,
        comprobanteMime:   imagen ? (mimetype || 'image/jpeg') : undefined,
    })

    conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.POST_ACCION })

    const avisoAdmin =
        '💰 *Comprobante de pago recibido*\n\n' +
        `👤 ${nombreCompleto(conv) || 'Sin nombre'}\n` +
        `✉️ ${conv.correo || 'sin correo'}\n` +
        `📱 ${conv.whatsapp || extractWhatsapp(jid) || 'sin número'}\n` +
        (caption ? `📝 "${caption}"\n` : '') +
        '\n_Cotéjalo con el banco antes de activar el acceso._'

    return { texto: PAGO_RECIBIDO_TEXTO, avisoAdmin }
}

/**
 * Respuesta cuando llega una imagen SIN que la estuviéramos esperando.
 * Mucha gente manda el comprobante directo, sin pasar por el menú — es lo más
 * natural. En vez de ignorarla (que es lo que pasaba antes), la encauzamos.
 */
export function imagenInesperada(jid) {
    const conv = conversaciones.get(jid) || {}
    conversaciones.set(jid, { ...datosUsuario(conv), paso: PASO.MENU, esNuevo: false })

    return (
        '📸 Recibí tu imagen.\n\n' +
        '¿Es tu *comprobante de pago*? Escribe *5* y lo registro correctamente ' +
        'para que quede ligado a tu cuenta.\n\n' +
        MENU_TEXTO()
    )
}
