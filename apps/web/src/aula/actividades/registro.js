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

export const TIPOS = {
    quiz: {
        nombre:     'Quiz',
        Componente: Quiz,
        resumen:    resumenQuiz,
    },

    // Por construir, cada una sobre este mismo molde:
    //
    //   memorama    → parejas que se destapan
    //   armar       → piezas que se arrastran, tipo lego
    //   modelo3d    → el visor con puntos marcables ← la prueba de fuego
    //
    // El modelo 3D es el difícil y el que va a decir si el contrato aguanta.
    // Se deja para cuando existan los modelos, no antes: construirlo con una
    // esfera de mentiras validaría el contrato contra un problema que no es el
    // real.
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
