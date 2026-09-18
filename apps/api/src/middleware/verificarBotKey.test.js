import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verificarBotKey } from './verificarBotKey.js'

function mockReq(headers = {}) {
    return { headers }
}

function mockNext() {
    const calls = []
    const next  = (err) => calls.push(err)
    next.calls  = calls
    return next
}

test('rechaza con 500 si BOT_API_KEY no está configurado', () => {
    delete process.env.BOT_API_KEY
    const next = mockNext()

    verificarBotKey(mockReq({ 'x-bot-key': 'lo-que-sea' }), {}, next)

    assert.equal(next.calls.length, 1)
    assert.equal(next.calls[0].statusCode, 500)
    assert.equal(next.calls[0].code, 'BOT_KEY_NOT_CONFIGURED')
})

test('rechaza con 401 si falta el header x-bot-key', () => {
    process.env.BOT_API_KEY = 'secreto-de-prueba'
    const next = mockNext()

    verificarBotKey(mockReq({}), {}, next)

    assert.equal(next.calls.length, 1)
    assert.equal(next.calls[0].statusCode, 401)
    assert.equal(next.calls[0].code, 'UNAUTHORIZED')
})

test('rechaza con 401 si el header no coincide', () => {
    process.env.BOT_API_KEY = 'secreto-de-prueba'
    const next = mockNext()

    verificarBotKey(mockReq({ 'x-bot-key': 'algo-distinto' }), {}, next)

    assert.equal(next.calls.length, 1)
    assert.equal(next.calls[0].statusCode, 401)
})

test('deja pasar (next sin error) si el header coincide', () => {
    process.env.BOT_API_KEY = 'secreto-de-prueba'
    const next = mockNext()

    verificarBotKey(mockReq({ 'x-bot-key': 'secreto-de-prueba' }), {}, next)

    assert.equal(next.calls.length, 1)
    assert.equal(next.calls[0], undefined)
})
