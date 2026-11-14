import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarAlta } from './profesorService.js'

const base = { email: 'Profe@Correo.com ', nombre: ' Ana ', apellido: '  Ruiz   García ', tallerId: 'taller-x' }

test('alta: normaliza correo, nombre y apellido', () => {
    assert.deepEqual(validarAlta(base), {
        email: 'profe@correo.com', nombre: 'Ana', apellido: 'Ruiz García', whatsapp: null, tallerId: 'taller-x',
    })
})

test('alta: WhatsApp opcional, y si viene se normaliza a 10 dígitos', () => {
    assert.equal(validarAlta({ ...base, whatsapp: '' }).whatsapp, null)
    assert.equal(validarAlta({ ...base, whatsapp: '+52 1 55 1234 5678' }).whatsapp, '5512345678')
})

test('alta: WhatsApp mal escrito se rechaza, no se guarda en silencio', () => {
    assert.throws(() => validarAlta({ ...base, whatsapp: '12345' }), /10 dígitos/)
})

test('alta: correo, nombre y taller son obligatorios', () => {
    assert.throws(() => validarAlta({ ...base, email: 'sin-arroba' }), /correo válido/)
    assert.throws(() => validarAlta({ ...base, nombre: '   ' }), /nombre/)
    assert.throws(() => validarAlta({ ...base, tallerId: '' }), /taller/)
    assert.throws(() => validarAlta(), /correo válido/)
})

test('alta: apellido vacío queda null', () => {
    assert.equal(validarAlta({ ...base, apellido: ' ' }).apellido, null)
})
