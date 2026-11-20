import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mensajeInvitacion, ligaInscripcion } from './prospectoTextos.js'

const taller = { nombre: 'Reflexología podal', fecha: '2026-12-04', horario: '5:00 PM – 7:00 PM', precio: 850 }

test('invitación: nombre, taller, fecha, precio y cómo inscribirse', () => {
    const m = mensajeInvitacion({ nombre: 'Ana Ruiz', origen: 'no_pago', taller })
    assert.match(m, /^¡Hola Ana! ✦/)
    assert.match(m, /nueva fecha de \*Reflexología podal\*/)
    assert.match(m, /📅 Viernes 4 de diciembre/)
    assert.match(m, /\(hora CDMX\)/)
    assert.match(m, /\$850 MXN/)
    assert.match(m, /Quiero inscribirme/)
    assert.doesNotMatch(m, /\n\n\n/)
})

test('invitación: a quien no alcanzó lugar se le dice por qué le avisamos primero', () => {
    assert.match(mensajeInvitacion({ nombre: '', origen: 'sin_cupo', taller }), /se llenó antes de que alcanzaras lugar/)
    assert.doesNotMatch(mensajeInvitacion({ origen: 'sin_cupo', taller: { ...taller, precio: 0 } }), /MXN/)
})

test('la liga del correo abre a Faro con el mensaje escrito', () => {
    assert.equal(ligaInscripcion('Iridología'),
        'https://wa.me/525577888800?text=Hola%20%E2%9C%A6%20Quiero%20inscribirme%20a%20Iridolog%C3%ADa')
})
