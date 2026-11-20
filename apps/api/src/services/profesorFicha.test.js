import { test } from 'node:test'
import assert from 'node:assert/strict'

const { validarFicha } = await import('./profesorService.js')

test('ficha: limpia textos, parte la formación en líneas y valida años', () => {
    const r = validarFicha({ especialidad: '  Terapeuta MTC ', semblanza: '', formacion: 'Lic. Fisioterapia\n\n  Diplomado MTC  ', aniosExperiencia: '12' })
    assert.equal(r.ok, true)
    assert.equal(r.ficha.especialidad, 'Terapeuta MTC')
    assert.equal(r.ficha.semblanza, null)
    assert.equal(r.ficha.formacion, 'Lic. Fisioterapia\nDiplomado MTC')
    assert.equal(r.ficha.aniosExperiencia, 12)
    assert.equal(r.ficha.foto, undefined)     // no se toca si no viene
    assert.equal(r.ficha.publicada, true)
})

test('ficha: rechaza años raros, foto que no es imagen y textos larguísimos', () => {
    assert.equal(validarFicha({ aniosExperiencia: '-1' }).ok, false)
    assert.equal(validarFicha({ aniosExperiencia: '3.5' }).ok, false)
    assert.equal(validarFicha({ foto: 'data:text/html;base64,AAAA' }).ok, false)
    assert.equal(validarFicha({ semblanza: 'x'.repeat(601) }).ok, false)
    assert.equal(validarFicha({ foto: null }).ficha.foto, null)
})
