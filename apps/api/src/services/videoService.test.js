import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nombreSala, crearTokenVideo } from './videoService.js'

test('nombreSala: una sala por taller, sin duplicar el prefijo del slug', () => {
    assert.equal(nombreSala('taller-auriculoterapia'), 'sala-taller-auriculoterapia')
    assert.equal(nombreSala('abc'), 'sala-abc')
})

test('crearTokenVideo: sin LIVEKIT_URL/llaves configuradas devuelve null, no truena', async () => {
    const antes = { ...process.env }
    delete process.env.LIVEKIT_URL
    delete process.env.LIVEKIT_API_KEY
    delete process.env.LIVEKIT_API_SECRET

    const video = await crearTokenVideo({ tallerId: 'abc', identity: '1', nombre: 'Ana' })
    assert.equal(video, null)

    process.env = antes
})

test('crearTokenVideo: con configuración completa devuelve token + serverUrl', async () => {
    const antes = { ...process.env }
    process.env.LIVEKIT_URL = 'ws://localhost:7880'
    process.env.LIVEKIT_API_KEY = 'devkey'
    process.env.LIVEKIT_API_SECRET = 'secret'

    const video = await crearTokenVideo({ tallerId: 'taller-x', identity: '42', nombre: 'Ana Ruiz' })
    assert.ok(video)
    assert.equal(video.serverUrl, 'ws://localhost:7880')
    assert.equal(typeof video.token, 'string')
    // Un JWT tiene 3 partes separadas por punto.
    assert.equal(video.token.split('.').length, 3)

    process.env = antes
})

test('crearTokenVideo: el rol viaja en la metadata del token (alumno por defecto)', async () => {
    const antes = { ...process.env }
    process.env.LIVEKIT_URL = 'ws://localhost:7880'
    process.env.LIVEKIT_API_KEY = 'devkey'
    process.env.LIVEKIT_API_SECRET = 'secret'

    const leer = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
    const profe = leer((await crearTokenVideo({ tallerId: 't', identity: '1', nombre: 'Ana', rol: 'profe' })).token)
    const alumno = leer((await crearTokenVideo({ tallerId: 't', identity: '2', nombre: 'Luis' })).token)
    const raro = leer((await crearTokenVideo({ tallerId: 't', identity: '3', nombre: 'X', rol: 'admin' })).token)

    assert.deepEqual(JSON.parse(profe.metadata), { rol: 'profe' })
    assert.deepEqual(JSON.parse(alumno.metadata), { rol: 'alumno' })
    assert.deepEqual(JSON.parse(raro.metadata), { rol: 'alumno' })
    assert.equal(profe.video.canUpdateOwnMetadata, false)

    process.env = antes
})
