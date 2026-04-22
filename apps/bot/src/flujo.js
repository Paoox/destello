/**
 * Destello Bot — Flujo de conversación
 * ─────────────────────────────────────────────────────────────
 * Maneja el estado de cada alumno que escribe al bot.
 *
 * Flujo:
 *   Alumno escribe → Bot pide nombre → Bot pide taller
 *   → Bot llama a la API → Bot entrega el código (chispa)
 */

import fetch from 'node-fetch'

const API_URL    = process.env.API_URL       || 'http://localhost:3001'
const ADMIN_PASS = process.env.ADMIN_PASSWORD

let adminToken = null  // se renueva automáticamente si expira

// ── Pasos de la conversación ──────────────────────────────────
const PASO = {
    INICIO: 'INICIO',
    NOMBRE: 'NOMBRE',
    TALLER: 'TALLER',
    LISTO:  'LISTO',
}

// ── Estado de cada alumno (número de WhatsApp → datos) ────────
const conversaciones = new Map()

// ── Obtener token de admin ────────────────────────────────────
async function getAdminToken() {
    if (adminToken) return adminToken

    if (!ADMIN_PASS) {
        throw new Error('Falta ADMIN_PASSWORD en el archivo .env del bot')
    }

    const res  = await fetch(`${API_URL}/admin/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password: ADMIN_PASS }),
    })
    const data = await res.json()

    if (!data.adminToken) {
        throw new Error(`Login de admin falló: ${JSON.stringify(data)}`)
    }

    adminToken = data.adminToken
    return adminToken
}

// ── Generar chispa llamando a la API ──────────────────────────
async function generarChispa(tallerId) {
    const token = await getAdminToken()

    const res = await fetch(`${API_URL}/admin/chispas`, {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
            tallerId,
            createdBy:     'bot-whatsapp',
            expiresInDays: 30,
        }),
    })

    // Si el token expiró, renovar y reintentar
    if (res.status === 401) {
        adminToken = null
        return generarChispa(tallerId)
    }

    const data = await res.json()

    if (!data.code) {
        throw new Error(`Error al generar chispa: ${JSON.stringify(data)}`)
    }

    return data.code  // ejemplo: "DEST-A1B2-C3D4"
}

// ── Función principal: procesa un mensaje y devuelve respuesta ─
export async function procesarMensaje(jid, texto) {
    const msg  = texto.trim()
    const conv = conversaciones.get(jid) || { paso: PASO.INICIO }

    // Cualquier momento: "cancelar" reinicia la conversación
    if (msg.toLowerCase() === 'cancelar') {
        conversaciones.delete(jid)
        return '✅ Conversación reiniciada. Escríbeme cuando quieras empezar de nuevo.'
    }

    // ── Paso 1: Primer mensaje del alumno ─────────────────────
    if (conv.paso === PASO.INICIO) {
        conversaciones.set(jid, { paso: PASO.NOMBRE })
        return (
            '✨ *¡Hola! Soy el asistente de Destello.*\n\n' +
            'Te ayudaré a obtener tu código de acceso para entrar a tu taller.\n\n' +
            '¿Cuál es tu nombre?'
        )
    }

    // ── Paso 2: Recibimos nombre, pedimos taller ──────────────
    if (conv.paso === PASO.NOMBRE) {
        conversaciones.set(jid, { paso: PASO.TALLER, nombre: msg })
        return (
            `¡Hola, *${msg}*! 👋\n\n` +
            'Estos son los talleres disponibles:\n\n' +
            '1️⃣  Ciencias\n' +
            '2️⃣  Matemáticas\n' +
            '3️⃣  Arte\n' +
            '4️⃣  Tecnología\n\n' +
            'Escribe el nombre del taller al que quieres acceder.'
        )
    }

    // ── Paso 3: Recibimos taller, generamos la chispa ─────────
    if (conv.paso === PASO.TALLER) {
        const tallerIds = {
            'ciencias':    'taller-ciencias',
            'matemáticas': 'taller-matematicas',
            'matematicas': 'taller-matematicas',
            'arte':        'taller-arte',
            'tecnología':  'taller-tecnologia',
            'tecnologia':  'taller-tecnologia',
        }

        const tallerId = tallerIds[msg.toLowerCase()]

        if (!tallerId) {
            return (
                '⚠️ No reconocí ese taller. Escribe exactamente:\n\n' +
                '*Ciencias, Matemáticas, Arte* o *Tecnología*'
            )
        }

        try {
            const codigo = await generarChispa(tallerId)
            conversaciones.set(jid, { ...conv, paso: PASO.LISTO })

            return (
                `🎉 *¡Listo, ${conv.nombre}!*\n\n` +
                `Tu código de acceso para *${msg}* es:\n\n` +
                `🔑  \`${codigo}\`\n\n` +
                `Úsalo aquí:\n👉 https://destello-web.vercel.app/acceso\n\n` +
                '_Código de un solo uso, válido 30 días._\n\n' +
                '¡Que disfrutes tu taller! ✨'
            )
        } catch (err) {
            console.error('[bot] Error generando chispa:', err.message)
            return '😔 Hubo un problema al generar tu código. Intenta de nuevo en unos minutos.'
        }
    }

    // ── Paso 4: Ya le entregamos su código ────────────────────
    if (conv.paso === PASO.LISTO) {
        return (
            '✅ Ya te envié tu código más arriba.\n\n' +
            'Si necesitas uno nuevo, escribe *cancelar* para empezar de nuevo.'
        )
    }

    // Fallback
    conversaciones.delete(jid)
    return '¡Hola! Escríbeme para comenzar. 😊'
}