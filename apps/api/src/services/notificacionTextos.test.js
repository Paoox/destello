import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armarNotificacion, mensajeWhatsapp, fmtHora, horarioDe, resumenAlumnas, yaNoSirve, TIPOS_WA } from './notificacionTextos.js'

const base = { taller: 'Auriculoterapia', horario: '5:00 PM – 7:00 PM', horaInicio: '17:00:00', fecha: '2026-11-20' }

test('horarioDe no repite "CDMX" si el panel ya lo puso', () => {
    assert.equal(horarioDe({ horario: '5:00 PM – 7:00 PM' }), '5:00 PM – 7:00 PM (hora CDMX)')
    assert.equal(horarioDe({ horario: '12:00 PM (CDMX)' }), '12:00 PM (CDMX)')
    assert.equal(horarioDe({ horaInicio: '17:00:00' }), '5:00 PM (hora CDMX)')
    assert.equal(horarioDe({}), null)
})

test('fmtHora pasa de 24 h a AM/PM', () => {
    assert.equal(fmtHora('17:00:00'), '5:00 PM')
    assert.equal(fmtHora('00:30:00'), '12:30 AM')
    assert.equal(fmtHora('12:00:00'), '12:00 PM')
    assert.equal(fmtHora(null), null)
})

test('taller_24h dice "mañana" u "hoy" según los días que faltan', () => {
    assert.match(armarNotificacion('taller_24h', { ...base, dias: 1 }).titulo, /mañana/)
    assert.match(armarNotificacion('taller_24h', { ...base, dias: 0 }).titulo, /hoy/)
    assert.match(mensajeWhatsapp('taller_24h', { ...base, dias: 1, nombre: 'Ana Ruiz' }), /¡Hola Ana! ✦/)
    assert.match(mensajeWhatsapp('taller_24h', { ...base, dias: 1 }), /\*mañana\* es tu taller \*Auriculoterapia\*/)
})

test('taller_1h da la hora de inicio y la liga a Inicio', () => {
    const wa = mensajeWhatsapp('taller_1h', base)
    assert.match(wa, /a las 5:00 PM/)
    assert.match(wa, /https:\/\/destello\.courses\/home/)
})

test('la profe solo ve cuántos alumnos registrados (con pago) tiene', () => {
    assert.equal(resumenAlumnas({ registrados: 9 }), 'Tienes 9 alumnos registrados.')
    assert.equal(resumenAlumnas({ registrados: 1 }), 'Tienes 1 alumno registrado.')
    const n = armarNotificacion('profe_24h', { ...base, dias: 1, registrados: 9 })
    assert.equal(n.titulo, 'Mañana impartes Auriculoterapia')
    assert.match(n.cuerpo, /Tienes 9 alumnos registrados\./)
    assert.doesNotMatch(n.cuerpo + mensajeWhatsapp('profe_24h', { ...base, dias: 1, registrados: 9 }),
        /pago|pendiente|inscrit/i)
})

test('solo los recordatorios de clase llevan WhatsApp', () => {
    for (const tipo of ['nuevo_taller', 'certificado', 'pago_confirmado', 'nueva_alumna']) {
        assert.equal(TIPOS_WA.has(tipo), false)
        assert.equal(mensajeWhatsapp(tipo, base), null)
    }
})

test('la respuesta a un reporte trae el asunto y el texto completo, sin WhatsApp', () => {
    const n = armarNotificacion('respuesta_soporte', {
        asunto: 'Perdí el acceso a mi correo', respuesta: 'Listo, ya cambié tu correo.', folio: 'R-00015', reporteId: 15 })
    assert.equal(n.titulo, 'Respuesta a tu reporte R-00015: Perdí el acceso a mi correo')
    assert.equal(n.cuerpo, 'Listo, ya cambié tu correo.')
    assert.equal(n.liga, '/settings?reporte=15')
    assert.equal(mensajeWhatsapp('respuesta_soporte', {}), null)
    assert.equal(armarNotificacion('respuesta_soporte', { respuesta: 'x' }).titulo, 'Respuesta a tu reporte')
    assert.equal(armarNotificacion('respuesta_soporte', { respuesta: 'x' }).liga, null)
})

test('el certificado liga a su folio', () => {
    assert.equal(armarNotificacion('certificado', { taller: 'X', folio: 'DST-2026-ABC123' }).liga,
        '/certificado/DST-2026-ABC123')
})

test('nuevo_taller lleva la fecha larga y liga al Hábitat', () => {
    const n = armarNotificacion('nuevo_taller', base)
    assert.match(n.cuerpo, /Viernes 20 de noviembre/)
    assert.equal(n.liga, '/habitat')
})

test('un recordatorio de una clase que ya empezó no se manda', () => {
    const ahora = Date.parse('2026-11-20T23:30:00Z')
    assert.equal(yaNoSirve({ tipo: 'taller_1h', datos: { inicio: '2026-11-20T23:00:00Z' } }, ahora), true)
    assert.equal(yaNoSirve({ tipo: 'taller_1h', datos: { inicio: '2026-11-21T00:00:00Z' } }, ahora), false)
    assert.equal(yaNoSirve({ tipo: 'nuevo_taller', datos: {} }, ahora), false)
})
