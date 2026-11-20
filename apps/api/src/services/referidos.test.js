import { test } from 'node:test'
import assert from 'node:assert/strict'

const { tocaCupon, MOTIVO_REFERIDO } = await import('./referralService.js')
const { precioConCupon } = await import('./inscripcionService.js')
const { armarNotificacion } = await import('./notificacionTextos.js')

test('cupón: cada 5 referidos que pagaron, no antes', () => {
    assert.deepEqual([0, 1, 4, 5, 6, 9, 10].map(tocaCupon), [false, false, false, true, false, false, true])
})

test('cupón: 30% sobre el precio, redondeado al peso', () => {
    assert.equal(precioConCupon(1200, { porcentaje: 30 }), 840)
    assert.equal(precioConCupon(999, { porcentaje: 30 }), 699)
    assert.equal(precioConCupon(1200, null), 1200)
})

test('referidos: mensajes legibles para cada motivo', () => {
    for (const m of ['CODE_NOT_FOUND', 'SELF', 'ALREADY_REFERRED', 'CICLO']) assert.ok(MOTIVO_REFERIDO[m])
})

test('avisos: Supernovas por referido y cupón', () => {
    const a = armarNotificacion('referido_pago', { supernovas: 50, invitado: 'Ana' })
    assert.match(a.titulo, /50 Supernovas/); assert.equal(a.liga, '/habitat')
    const c = armarNotificacion('cupon', { porcentaje: 30, referidos: 5, vence: '2027-05-19' })
    assert.match(c.titulo, /30%/); assert.match(c.cuerpo, /mayo/)
})
