import { test } from 'node:test'
import assert from 'node:assert/strict'
import { asegurarTallerLibre } from './profesorService.js'

test('un profe por taller: si ya lo da otra persona, 409 con su nombre', async () => {
    const q = async () => ({ rows: [{ nombre: 'Minerva', apellido: 'Marquez', email: 'm@x.com' }] })
    await assert.rejects(asegurarTallerLibre('taller-x', 5, q), (e) => {
        assert.equal(e.statusCode ?? e.status, 409)
        assert.match(e.message, /Minerva Marquez/)
        return true
    })
})

test('un profe por taller: libre (o la misma persona) no truena', async () => {
    const q = async () => ({ rows: [] })
    await assert.doesNotReject(asegurarTallerLibre('taller-x', 5, q))
})
