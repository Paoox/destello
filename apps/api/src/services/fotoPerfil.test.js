import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validarFoto, FOTO_MAX_BYTES } from './fotoPerfil.js'

test('foto: acepta una imagen chica y permite quitarla', () => {
    const ok = 'data:image/webp;base64,UklGRhAAAABXRUJQ'
    assert.deepEqual(validarFoto(ok), { foto: ok })
    assert.deepEqual(validarFoto(null), { foto: null })
})

test('foto: rechaza lo que no es imagen, URLs externas y archivos grandes', () => {
    assert.ok(validarFoto('https://ejemplo.com/a.png').error)
    assert.ok(validarFoto('data:text/html;base64,PHNjcmlwdD4=').error)
    assert.ok(validarFoto('data:image/svg+xml;base64,PHN2Zz4=').error)   // SVG puede traer scripts
    assert.ok(validarFoto(undefined).error)
    assert.ok(validarFoto('data:image/png;base64,' + 'A'.repeat(FOTO_MAX_BYTES)).error)
})
