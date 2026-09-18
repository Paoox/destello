import { test } from 'node:test'
import assert from 'node:assert/strict'
import { textoRecordatorio } from './recordatorioAutoService.js'

test('usa el primer nombre y el nombre del taller', () => {
    const texto = textoRecordatorio('Ana Ruiz García', 'Auriculoterapia')
    assert.match(texto, /¡Hola Ana! ✦/)
    assert.match(texto, /\*Auriculoterapia\*/)
})

test('nombre ausente cae a "alumno\\/a", taller ausente cae a "el taller"', () => {
    const texto = textoRecordatorio(null, null)
    assert.match(texto, /¡Hola alumno\/a! ✦/)
    assert.match(texto, /\*el taller\*/)
})

test('siempre termina pidiendo confirmación', () => {
    const texto = textoRecordatorio('Luis', 'Iridología')
    assert.match(texto, /¿Me confirmas\?$/)
})

test('reenvía los datos de pago (SPEI y tarjeta)', () => {
    const texto = textoRecordatorio('Luis', 'Iridología')
    assert.match(texto, /036180500687558754/)
    assert.match(texto, /4658 2850 1724 7424/)
})
