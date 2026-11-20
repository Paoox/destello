import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodificarImagen } from './storageService.js'

const PNG_1PX = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

test('imagen de soporte: acepta jpg/png/webp en data URL', () => {
    const r = decodificarImagen(`data:image/png;base64,${PNG_1PX}`)
    assert.equal(r.ok, true)
    assert.equal(r.mime, 'image/png')
    assert.ok(r.buffer.length > 0)
    assert.equal(decodificarImagen(`data:image/jpg;base64,${PNG_1PX}`).mime, 'image/jpeg')
})

test('imagen de soporte: rechaza otros tipos o basura', () => {
    assert.equal(decodificarImagen('data:application/pdf;base64,AAAA').ok, false)
    assert.equal(decodificarImagen('data:image/svg+xml;base64,AAAA').ok, false)
    assert.equal(decodificarImagen('hola').ok, false)
    assert.equal(decodificarImagen(null).ok, false)
})
