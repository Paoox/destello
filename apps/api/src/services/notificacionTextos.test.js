import { test } from 'node:test'
import assert from 'node:assert/strict'
import { armarNotificacion, mensajeWhatsapp, fmtHora, resumenAlumnas, yaNoSirve, TIPOS_WA } from './notificacionTextos.js'

const base = { taller: 'Auriculoterapia', horario: '5:00 PM – 7:00 PM', horaInicio: '17:00:00', fecha: '2026-11-20' }

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

test('la profe ve cuántas inscritas y pagadas', () => {
    assert.equal(resumenAlumnas({ inscritas: 12, pagadas: 9 }), 'Van 12 inscritas, 9 con pago confirmado.')
    assert.equal(resumenAlumnas({ inscritas: 1, pagadas: 1 }), 'Van 1 inscrita, 1 con pago confirmado.')
    const n = armarNotificacion('profe_24h', { ...base, dias: 1, inscritas: 12, pagadas: 9 })
    assert.equal(n.titulo, 'Mañana impartes Auriculoterapia')
    assert.match(n.cuerpo, /12 inscritas/)
})

test('solo los recordatorios de clase llevan WhatsApp', () => {
    for (const tipo of ['nuevo_taller', 'certificado', 'pago_confirmado', 'nueva_alumna']) {
        assert.equal(TIPOS_WA.has(tipo), false)
        assert.equal(mensajeWhatsapp(tipo, base), null)
    }
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
