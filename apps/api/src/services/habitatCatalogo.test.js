import { test } from 'node:test'
import assert from 'node:assert/strict'
import { limpiarPuestos, CATALOGO, POR_ID } from './habitatCatalogo.js'

test('catálogo: ids únicos y precios no negativos', () => {
    assert.equal(new Set(CATALOGO.map(x => x.id)).size, CATALOGO.length)
    assert.ok(CATALOGO.every(x => Number.isInteger(x.precio) && x.precio >= 0))
})

test('puestos: quita lo que no tiene, lo que no existe y lo que va en otro lugar', () => {
    const r = limpiarPuestos({ cama: 'cama-nube', sofa: 'gato', mascota: 'dragon', alfombra: 'alfombra-zen', mesa: 'mesa-te' }, ['mesa-te'])
    assert.deepEqual(r, { alfombra: 'alfombra-zen', mesa: 'mesa-te', pared: 'pared-crema', piso: 'piso-madera' })
    assert.equal(POR_ID['alfombra-zen'].precio, 0)
})

test('puestos: pared y piso nunca quedan vacíos; uno comprado sí se respeta', () => {
    assert.equal(limpiarPuestos({}, []).pared, 'pared-crema')
    assert.equal(limpiarPuestos({ pared: 'pared-jade' }, ['pared-jade']).pared, 'pared-jade')
    assert.equal(limpiarPuestos({ pared: 'pared-jade' }, []).pared, 'pared-crema')
})

import { disponibilidadSello, evaluarReto, RETO_SEGUNDOS, RETO_MARGEN } from './habitatCatalogo.js'

test('sello: lo básico siempre está, premium bloqueado', () => {
    assert.equal(disponibilidadSello({ acceso: 'siempre', fechaTaller: '2020-01-01' }).disponible, true)
    const p = disponibilidadSello({ acceso: 'premium', fechaTaller: null })
    assert.equal(p.disponible, false); assert.equal(p.motivo, 'premium')
})

test('sello 30dias: abierto 30 días después del taller (hora CDMX)', () => {
    const ok = disponibilidadSello({ acceso: '30dias', fechaTaller: '2026-11-01', ahora: new Date('2026-12-01T20:00:00-06:00') })
    assert.equal(ok.disponible, true)
    const no = disponibilidadSello({ acceso: '30dias', fechaTaller: '2026-11-01', ahora: new Date('2026-12-02T00:30:00-06:00') })
    assert.equal(no.disponible, false); assert.equal(no.motivo, 'vencido')
})

test('reto: gana dentro del límite + margen, una sola vez', () => {
    const lim = RETO_SEGUNDOS.sopa
    assert.equal(evaluarReto({ tipo: 'sopa', segundos: lim + RETO_MARGEN, yaGanado: false }).gano, true)
    assert.equal(evaluarReto({ tipo: 'sopa', segundos: lim + RETO_MARGEN + 0.1, yaGanado: false }).gano, false)
    assert.equal(evaluarReto({ tipo: 'sopa', segundos: 10, yaGanado: true }).gano, false)
    assert.equal(evaluarReto({ tipo: 'modelo3d', segundos: 1, yaGanado: false }).hayReto, false)
})
