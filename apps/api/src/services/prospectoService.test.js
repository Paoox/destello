import { test } from 'node:test'
import assert from 'node:assert/strict'

process.env.RESEND_API_KEY ??= 're_test_dummy'   // mailService crea Resend al importar
const { motivoLegible } = await import('./prospectoService.js')

test('los errores de envío se dicen en palabras', () => {
    assert.equal(motivoLegible('whatsapp', new Error('fetch failed')), 'WhatsApp: el bot Faro no responde')
    assert.equal(motivoLegible('correo', new Error('API key is invalid')), 'correo: la llave de Resend no es válida')
    assert.equal(motivoLegible('correo', new Error('algo raro')), 'correo: algo raro')
})
