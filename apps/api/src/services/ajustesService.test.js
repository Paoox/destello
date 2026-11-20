import { test } from 'node:test'
import assert from 'node:assert/strict'

// Solo se prueba la regla pura; importar el módulo no toca la BD ni el bot.
process.env.RESEND_API_KEY ??= 're_prueba'
const { validarBaja, PALABRA_BAJA, armarDetalleSoporte, CATEGORIAS_SOPORTE } = await import('./ajustesService.js')

test('soporte: la categoría y el taller van al inicio del reporte', () => {
    const r = armarDetalleSoporte({ categoria: 'material_30dias', taller: 'Iridología', detalle: '  ¿Hasta cuándo veo el video? ' })
    assert.equal(r.ok, true)
    assert.equal(r.detalle, '[Dudas con los 30 días de material del taller] [Iridología] ¿Hasta cuándo veo el video?')
})

test('soporte: pide categoría válida y algo de mensaje', () => {
    assert.equal(armarDetalleSoporte({ categoria: 'inventada', detalle: 'hola hola' }).ok, false)
    assert.equal(armarDetalleSoporte({ categoria: 'otro', detalle: 'hey' }).ok, false)
    assert.equal(armarDetalleSoporte({ categoria: 'otro', detalle: 'no sé qué pasó' }).ok, true)
    assert.ok(Object.keys(CATEGORIAS_SOPORTE).includes('correo_perdido'))
})

test('la baja pide escribir ELIMINAR', () => {
    assert.equal(validarBaja({ confirmacion: '' }).code, 'SIN_CONFIRMAR')
    assert.equal(validarBaja({ confirmacion: 'eliminar ' }).ok, true)
    assert.equal(validarBaja({ confirmacion: PALABRA_BAJA }).ok, true)
    assert.equal(validarBaja({ confirmacion: 'borrar' }).ok, false)
})

test('una profe con talleres asignados no se puede dar de baja sola', () => {
    const r = validarBaja({ confirmacion: 'ELIMINAR', talleresQueImparte: 2 })
    assert.equal(r.ok, false)
    assert.equal(r.code, 'ES_PROFE')
})
