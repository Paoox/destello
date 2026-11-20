/**
 * Catálogo del Hábitat (19 nov 2026). Los PRECIOS viven aquí, en la API —
 * el navegador nunca decide cuánto cuesta algo. Los dibujos viven en
 * `apps/web/src/habitat/` con el mismo `id`.
 *
 * `lugar`: dónde va en la casa. Un lugar tiene una sola cosa puesta; dos
 * objetos del mismo lugar son alternativas (cama nube o futón).
 * `pared` y `piso` son estilos: siempre hay uno (el gratis si no eligió).
 * Precio 0 = lo tiene todo mundo desde el principio.
 */

export const SUPERNOVAS_POR_TALLER   = 100
export const SUPERNOVAS_POR_REFERIDO = 50

// ── Sellos que abren actividades (migración 029) ──
/** Supernovas por ganar el reto de una actividad (una sola vez por actividad). */
export const SUPERNOVAS_POR_RETO = 20
/** Tiempo límite del reto por tipo de actividad. Sin entrada = sin reto. */
export const RETO_SEGUNDOS = { quiz: 40, trivia: 45, sopa: 60, memorama: 60, crucigrama: 120 }
/** Margen por la red (lo que tarda en ir y venir el aviso de "terminé"). */
export const RETO_MARGEN = 3
/** Días que sigue abierto el material '30dias' después del taller. */
export const DIAS_MATERIAL = 30

/**
 * ¿Se puede jugar hoy la actividad de un sello? (pura)
 * @param {{acceso: string, fechaTaller: string|Date|null, ahora?: Date}} p
 * @returns {{disponible: boolean, venceAt: Date|null, motivo: string|null}}
 */
export function disponibilidadSello({ acceso, fechaTaller, ahora = new Date() }) {
    if (acceso === 'premium') return { disponible: false, venceAt: null, motivo: 'premium' }
    if (acceso !== '30dias') return { disponible: true, venceAt: null, motivo: null }
    if (!fechaTaller) return { disponible: true, venceAt: null, motivo: null }
    const base = typeof fechaTaller === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fechaTaller)
        ? new Date(`${fechaTaller}T23:59:59-06:00`) : new Date(fechaTaller)
    const venceAt = new Date(base.getTime() + DIAS_MATERIAL * 86400000)
    return ahora <= venceAt
        ? { disponible: true, venceAt, motivo: null }
        : { disponible: false, venceAt, motivo: 'vencido' }
}

/**
 * ¿Ganó el reto? (pura)
 * @returns {{hayReto: boolean, limite: number|null, gano: boolean}}
 */
export function evaluarReto({ tipo, segundos, yaGanado }) {
    const limite = RETO_SEGUNDOS[tipo] ?? null
    if (!limite) return { hayReto: false, limite: null, gano: false }
    return { hayReto: true, limite, gano: !yaGanado && Number(segundos) <= limite + RETO_MARGEN }
}

export const LUGARES = {
    pared: 'Paredes', piso: 'Piso',
    cama: 'Cama', sofa: 'Sillón', escritorio: 'Escritorio', librero: 'Librero',
    alfombra: 'Alfombra', mesa: 'Mesita', planta_rincon: 'Planta del rincón',
    planta_frente: 'Planta', lampara: 'Lámpara', cuadro_der: 'Cuadro', cuadro_izq: 'Cuadro junto a la ventana',
    cortinas: 'Cortinas', repisa: 'Repisa', mascota: 'Mascota', puff: 'Puff',
}

const o = (id, nombre, lugar, precio, descripcion) => ({ id, nombre, lugar, precio, descripcion, tipo: lugar === 'pared' || lugar === 'piso' ? 'estilo' : 'mueble' })

export const CATALOGO = [
    // Estilos
    o('pared-crema',    'Crema',        'pared', 0,  'El color de siempre'),
    o('pared-jade',     'Jade',         'pared', 60, 'Verde jade, como Destello'),
    o('pared-ambar',    'Ámbar',        'pared', 60, 'Cálido como una tarde'),
    o('pared-lavanda',  'Lavanda',      'pared', 60, 'Suave y tranquila'),
    o('pared-cielo',    'Cielo',        'pared', 60, 'Azul claro'),
    o('pared-noche',    'Noche',        'pared', 80, 'Azul profundo con estrellitas'),
    o('piso-madera',    'Madera',       'piso',  0,  'Duela de madera'),
    o('piso-clara',     'Madera clara', 'piso',  60, 'Duela clara nórdica'),
    o('piso-tatami',    'Tatami',       'piso',  80, 'Esteras japonesas'),
    o('piso-mosaico',   'Mosaico',      'piso',  80, 'Mosaico de colores'),
    // Muebles
    o('alfombra-zen',   'Alfombra zen',      'alfombra', 0,   'Para empezar'),
    o('alfombra-rayas', 'Alfombra de rayas', 'alfombra', 40,  'Rayas jade y crema'),
    o('helecho',        'Helecho',           'planta_frente', 0, 'Tu primera planta'),
    o('cactus',         'Cactus',            'planta_frente', 30, 'Pide poca agua'),
    o('monstera',       'Monstera',          'planta_rincon', 45, 'Hojas grandes en el rincón'),
    o('bambu',          'Bambú',             'planta_rincon', 45, 'De la suerte'),
    o('cama-nube',      'Cama nube',         'cama', 80,  'Esponjosa, con cobija'),
    o('cama-futon',     'Futón japonés',     'cama', 60,  'Bajito, estilo japonés'),
    o('sofa-jade',      'Sillón jade',       'sofa', 90,  'Para leer o descansar'),
    o('sofa-ambar',     'Sillón ámbar',      'sofa', 90,  'Mostaza retro'),
    o('escritorio',     'Escritorio',        'escritorio', 100, 'Con compu y silla, para tus clases'),
    o('librero',        'Librero',           'librero', 70,  'Lleno de libros'),
    o('mesa-te',        'Mesita de té',      'mesa', 50,  'Con tetera'),
    o('lampara',        'Lámpara de pie',    'lampara', 40, 'Luz cálida'),
    o('cuadro-montana', 'Cuadro montaña',    'cuadro_der', 30, 'Paisaje de montaña'),
    o('cuadro-ola',     'Cuadro ola',        'cuadro_izq', 30, 'La gran ola'),
    o('cortinas',       'Cortinas',          'cortinas', 35, 'Para la ventana'),
    o('repisa',         'Repisa con plantas', 'repisa', 50, 'Plantitas colgantes'),
    o('puff',           'Puff',              'puff', 35,  'Para sentarse en el piso'),
    o('gato',           'Gatito',            'mascota', 120, 'Te acompaña en clase'),
    o('perrito',        'Perrito',           'mascota', 120, 'Siempre feliz de verte'),
]

export const POR_ID = Object.fromEntries(CATALOGO.map(x => [x.id, x]))

/** Lo que trae una casa nueva. */
export const PUESTOS_INICIALES = { pared: 'pared-crema', piso: 'piso-madera', alfombra: 'alfombra-zen', planta_frente: 'helecho' }

/**
 * Limpia lo que manda el navegador (pura, con pruebas): solo objetos que
 * existen, en su lugar correcto y que la persona tiene (o son gratis).
 * Pared y piso nunca quedan vacíos.
 */
export function limpiarPuestos(puestos, propios = []) {
    const tiene = new Set(propios)
    const limpio = {}
    for (const [lugar, id] of Object.entries(puestos ?? {})) {
        const obj = POR_ID[id]
        if (!obj || obj.lugar !== lugar) continue
        if (obj.precio > 0 && !tiene.has(id)) continue
        limpio[lugar] = id
    }
    limpio.pared ??= PUESTOS_INICIALES.pared
    limpio.piso  ??= PUESTOS_INICIALES.piso
    return limpio
}
