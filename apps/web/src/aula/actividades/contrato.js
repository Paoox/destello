/**
 * Destello — El contrato de actividad
 *
 * ══════════════════════════════════════════════════════════════════════════
 *  ESTE ES EL ARCHIVO MÁS IMPORTANTE DEL AULA
 * ══════════════════════════════════════════════════════════════════════════
 *
 * Un quiz, un memorama, un rompecabezas de piezas y un modelo 3D con puntos de
 * acupuntura no se parecen en NADA por dentro. Pero los cuatro tienen que hacer
 * exactamente las mismas cinco cosas para que el aula funcione:
 *
 *   1. Abrirse cuando la profe lo ordena.
 *   2. Reportar su ESTADO — de ahí sale la miniatura de la profe, y de ahí sale
 *      que alguien pueda recuperar su ejercicio si se le cae el internet.
 *   3. Avisar si la persona está INTERACTUANDO — el semáforo verde y rojo.
 *   4. Aceptar SELLOS encima.
 *   5. Ir BLOQUEADA o LIBERADA.
 *
 * Definir esto UNA vez es la diferencia entre que la quinta actividad cueste un
 * día o cueste lo mismo que la primera, para siempre. Y es de lo que depende que
 * el aula se le pueda rentar a alguien más: quien la contrate va a querer sus
 * propias actividades, y solo puede hacerlas si hay un molde.
 *
 * ── Cómo se escribe una actividad nueva ──────────────────────────────────
 *
 * Es un componente de React que recibe SIEMPRE las mismas props (abajo) y que
 * no sabe nada del aula: ni de video, ni de quién es la profe, ni de sellos.
 * Solo sabe de su propio ejercicio. El aula la envuelve y se encarga del resto.
 *
 * @typedef {Object} PropsDeActividad
 *
 * @property {Object}  contenido  Lo que hay que resolver: las preguntas del
 *   quiz, las piezas del rompecabezas, el modelo y sus puntos. Sale de la
 *   PLANTILLA del taller — nunca está escrito dentro del componente. Es lo que
 *   permite que el mismo quiz sirva para auriculoterapia y para IA generativa.
 *
 * @property {Object}  estado  Dónde va la persona. Lo guarda el aula, no la
 *   actividad, porque tiene que sobrevivir a que se recargue la página y tiene
 *   que viajar a la pantalla de la profe.
 *
 * @property {Function} onCambio  `(estadoNuevo) => void`. La actividad lo llama
 *   CADA vez que la persona hace algo. Dispara tres cosas de un golpe: se
 *   guarda el avance, se repinta la miniatura de la profe, y **se reinicia el
 *   temporizador del semáforo**.
 *
 *   ⚠️ Llamarlo también cuando la persona toca algo sin avanzar (girar el
 *   modelo, destapar una carta y volverla a tapar): eso ES interactuar, y si no
 *   se reporta, alguien que está trabajando se pinta de rojo.
 *
 * @property {boolean} liberado  `false` mientras la profe explica en su modelo.
 *   La actividad se sigue viendo, pero **no se deja tocar**. Cada actividad
 *   decide cómo se ve eso; lo que no puede es ignorarlo.
 *
 * @property {boolean} esProfe  La profe ve la actividad para explicarla, y
 *   cuando abre el pizarrón de una alumna, para revisarlo. Algunas actividades
 *   le muestran de más (las respuestas correctas, por ejemplo).
 */

/**
 * Toda actividad exporta esto junto con su componente, para que el aula pueda
 * pintar la miniatura de la rejilla SIN montar la actividad completa.
 *
 * POR QUÉ IMPORTA: son 20 miniaturas actualizándose en vivo. Si cada una
 * montara un quiz o un visor 3D de verdad para dibujarse, la pantalla de la
 * profe se arrastraría. La miniatura se calcula con dos números.
 *
 * @typedef {Object} ResumenDeActividad
 * @property {number}  avance    0 a 100
 * @property {string}  etiqueta  Texto corto: "3 de 8", "casi", "sin empezar"
 * @property {boolean} terminado
 */

/** El estado con el que arranca cualquiera que abre una actividad por primera vez. */
export const ESTADO_INICIAL = Object.freeze({ pasos: {}, ultimoCambio: null })

/**
 * Ayuda para que ninguna actividad tenga que acordarse de estampar la hora.
 *
 * El `ultimoCambio` es lo que alimenta el semáforo: si no se estampa, la
 * persona se pinta de rojo aunque esté trabajando. Por eso se hace aquí y no
 * se le deja a cada actividad — es justo el detalle que se olvida.
 */
export const marcarCambio = (estado, cambios) => ({
    ...estado,
    ...cambios,
    ultimoCambio: Date.now(),
})
