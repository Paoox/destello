import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clabeValida, tarjetaValida, validarDatosPago } from './datosPagoService.js'

test('CLABE: dígito de control', () => {
    assert.equal(clabeValida('036180500687558754'), true)    // la de Destello
    assert.equal(clabeValida('036180500687558755'), false)   // último dígito mal
    assert.equal(clabeValida('03618050068755875'), false)    // 17 dígitos
})

test('Tarjeta: Luhn', () => {
    assert.equal(tarjetaValida('4658285017247424'), true)    // la de Destello
    assert.equal(tarjetaValida('4658285017247425'), false)
    assert.equal(tarjetaValida('465828501724'), false)
})

test('validarDatosPago: limpia espacios y pide lo mínimo', () => {
    const d = validarDatosPago({ titular: '  Ana  Ruiz ', banco: 'BBVA', clabe: '0361 8050 0687 5587 54', tarjeta: '' })
    assert.deepEqual(d, { titular: 'Ana Ruiz', banco: 'BBVA', clabe: '036180500687558754', tarjeta: null })
    assert.throws(() => validarDatosPago({ titular: 'Ana Ruiz', banco: 'BBVA' }), /CLABE o el número de tarjeta/)
    assert.throws(() => validarDatosPago({ titular: 'A', banco: 'BBVA', clabe: '036180500687558754' }), /titular/)
    assert.throws(() => validarDatosPago({ titular: 'Ana', banco: 'BBVA', clabe: '036180500687558755' }), /CLABE no es válida/)
    assert.throws(() => validarDatosPago({ titular: 'Ana', banco: 'BBVA', tarjeta: '4658285017247425' }), /tarjeta no es válido/)
})
