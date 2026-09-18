import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rateLimit, clientIp } from './rateLimit.js'

function mockReq(ip) {
    return { headers: { 'cf-connecting-ip': ip }, ip: '127.0.0.1' }
}

function mockRes() {
    const headers = {}
    return {
        headers,
        set(name, value) { headers[name] = value },
    }
}

function mockNext() {
    const calls = []
    const next  = (err) => calls.push(err)
    next.calls  = calls
    return next
}

test('clientIp prefiere cf-connecting-ip sobre req.ip', () => {
    assert.equal(clientIp(mockReq('9.9.9.9')), '9.9.9.9')
    assert.equal(clientIp({ headers: {}, ip: '127.0.0.1' }), '127.0.0.1')
})

test('deja pasar hasta el límite, luego responde 429', () => {
    const limitar = rateLimit({ windowMs: 60_000, max: 3 })
    const req     = mockReq('1.1.1.1')

    for (let i = 0; i < 3; i++) {
        const next = mockNext()
        limitar(req, mockRes(), next)
        assert.equal(next.calls[0], undefined, `intento ${i + 1} debería pasar`)
    }

    const next = mockNext()
    const res  = mockRes()
    limitar(req, res, next)

    assert.equal(next.calls.length, 1)
    assert.equal(next.calls[0].statusCode, 429)
    assert.equal(next.calls[0].code, 'TOO_MANY_REQUESTS')
    assert.ok(res.headers['Retry-After'])
})

test('cuenta cada IP por separado', () => {
    const limitar = rateLimit({ windowMs: 60_000, max: 1 })

    const next1 = mockNext()
    limitar(mockReq('2.2.2.2'), mockRes(), next1)
    assert.equal(next1.calls[0], undefined)

    // Otra IP no hereda el conteo de la primera.
    const next2 = mockNext()
    limitar(mockReq('3.3.3.3'), mockRes(), next2)
    assert.equal(next2.calls[0], undefined)

    // La primera IP ya agotó su cupo.
    const next3 = mockNext()
    limitar(mockReq('2.2.2.2'), mockRes(), next3)
    assert.equal(next3.calls[0]?.statusCode, 429)
})

test('vuelve a permitir pasado el tiempo de la ventana', async () => {
    const limitar = rateLimit({ windowMs: 50, max: 1 })
    const req     = mockReq('4.4.4.4')

    const next1 = mockNext()
    limitar(req, mockRes(), next1)
    assert.equal(next1.calls[0], undefined)

    const next2 = mockNext()
    limitar(req, mockRes(), next2)
    assert.equal(next2.calls[0]?.statusCode, 429)

    await new Promise((r) => setTimeout(r, 70))

    const next3 = mockNext()
    limitar(req, mockRes(), next3)
    assert.equal(next3.calls[0], undefined)
})
