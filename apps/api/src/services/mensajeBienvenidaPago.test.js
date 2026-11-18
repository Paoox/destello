import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fechaLarga, mensajeBienvenidaPago } from './mensajeBienvenidaPago.js'

test('fechaLarga: día correcto, sin corrimiento por zona horaria', () => {
    assert.equal(fechaLarga('2026-11-30'), 'lunes 30 de noviembre')
    assert.equal(fechaLarga('2026-01-01'), 'jueves 1 de enero')
    assert.equal(fechaLarga(null), null)
    assert.equal(fechaLarga('no es fecha'), null)
})

test('mensaje de pago confirmado: bienvenida al taller, SIN datos de pago (T-48)', () => {
    const msg = mensajeBienvenidaPago({
        nombre: 'Ana López', taller: 'IA para perezosos', fecha: '2026-11-30', horario: '10:00 – 12:00',
    })
    assert.match(msg, /¡Hola Ana!/)
    assert.match(msg, /confirmado/)
    assert.match(msg, /\*IA para perezosos\*/)
    assert.match(msg, /Lunes 30 de noviembre/)
    assert.match(msg, /10:00 – 12:00/)
    assert.match(msg, /destello\.courses\/login/)
    for (const prohibido of [/CLABE/i, /tarjeta/i, /036180500687558754/, /4658/, /realiza tu pago/i]) {
        assert.doesNotMatch(msg, prohibido)
    }
})

test('mensaje de pago confirmado: sin fecha ni horario no deja líneas vacías raras', () => {
    const msg = mensajeBienvenidaPago({ nombre: '', taller: null, fecha: null, horario: null })
    assert.match(msg, /¡Hola! Recibimos tu pago/)
    assert.doesNotMatch(msg, /📅|🕐|undefined|null/)
})
