import { test } from 'node:test'
import assert from 'node:assert/strict'
import { partirNombre } from './inscripcionService.js'

test('nombre y apellido: primera palabra es el nombre, el resto el apellido', () => {
    assert.deepEqual(partirNombre('Ana Ruiz García'), { nombre: 'Ana', apellido: 'Ruiz García' })
})

test('un solo nombre: apellido queda null, no vacío', () => {
    assert.deepEqual(partirNombre('Ana'), { nombre: 'Ana', apellido: null })
})

test('espacios extra se colapsan antes de partir', () => {
    assert.deepEqual(partirNombre('  Ana   Ruiz   García  '), { nombre: 'Ana', apellido: 'Ruiz García' })
})

test('null o vacío no truena, devuelve ambos null', () => {
    assert.deepEqual(partirNombre(null), { nombre: null, apellido: null })
    assert.deepEqual(partirNombre(''), { nombre: null, apellido: null })
})
