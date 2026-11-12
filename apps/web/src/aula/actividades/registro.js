/**
 * Destello — El registro de actividades
 *
 * La lista de todo lo que se puede montar en el pizarrón. Agregar una actividad
 * nueva es escribir su componente y sumar un renglón aquí — **nada más se
 * toca**. Ni el aula, ni el pizarrón, ni la rejilla de la profe.
 *
 * Ese es el examen de si el contrato quedó bien: si algún día agregar el
 * memorama obliga a modificar `Aula.jsx`, es que algo se coló donde no iba.
 */
import Quiz, { resumen as resumenQuiz } from './Quiz.jsx'
import Memorama, { resumen as resumenMemorama } from './Memorama.jsx'
import Caso, { resumen as resumenCaso } from './Caso.jsx'
import Sopa, { resumen as resumenSopa } from './Sopa.jsx'
import Crucigrama, { resumen as resumenCrucigrama } from './Crucigrama.jsx'
import Trivia, { resumen as resumenTrivia } from './Trivia.jsx'
import Modelo3D, { resumen as resumenModelo3D } from './Modelo3D.jsx'

export const TIPOS = {
    quiz: {
        nombre:     'Quiz',
        Componente: Quiz,
        resumen:    resumenQuiz,
    },

    memorama: {
        nombre:     'Memorama',
        Componente: Memorama,
        resumen:    resumenMemorama,
    },

    // Decisiones paso a paso, con modelo 3D opcional (el visor vive en
    // `aula/visor3d/` y se puede reusar en otras actividades).
    caso: {
        nombre:     'Caso',
        Componente: Caso,
        resumen:    resumenCaso,
    },

    sopa: {
        nombre:     'Sopa de letras',
        Componente: Sopa,
        resumen:    resumenSopa,
    },

    crucigrama: {
        nombre:     'Crucigrama',
        Componente: Crucigrama,
        resumen:    resumenCrucigrama,
    },

    // A diferencia del Quiz, dice al momento si atinaste (es juego, no examen).
    trivia: {
        nombre:     'Trivia',
        Componente: Trivia,
        resumen:    resumenTrivia,
    },

    // Un modelo 3D solito para explorarlo (girar, acercar, ver puntos).
    // Sin preguntas ni calificación.
    modelo3d: {
        nombre:     'Modelo 3D',
        Componente: Modelo3D,
        resumen:    resumenModelo3D,
    },

    // Por construir, sobre este mismo molde:
    //
    //   armar       → piezas que se arrastran, tipo lego
}

/** Busca el tipo de una actividad. `null` si es un tipo que ya no existe. */
export const tipoDe = (actividad) => actividad?.tipo ? TIPOS[actividad.tipo] ?? null : null

/**
 * Resumen para la miniatura de la profe.
 *
 * Va aquí, y no dentro de cada actividad, para que la rejilla nunca tenga que
 * preguntarse de qué tipo es lo que está dibujando. Si el tipo desapareció,
 * devuelve algo razonable en vez de tronar: en medio de una clase, una
 * miniatura en blanco es mejor que una pantalla caída.
 */
export function resumenDe(actividad, estado) {
    const tipo = tipoDe(actividad)
    if (!tipo?.resumen) return { avance: 0, etiqueta: '', terminado: false }
    try {
        return tipo.resumen(actividad.contenido, estado)
    } catch {
        return { avance: 0, etiqueta: '', terminado: false }
    }
}
