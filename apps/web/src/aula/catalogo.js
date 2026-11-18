/**
 * Destello — El aula: catálogo de sellos y reacciones
 *
 * POR QUÉ ESTÁ SEPARADO DEL CÓDIGO
 *
 * Los sellos y las reacciones son **contenido**, no programación. Paola va a
 * mandar a hacer las ilustraciones y las va a querer cambiar, agregar y quitar
 * sin tocar un componente. Por eso viven en una lista con nombre, y no
 * escritos a mano dentro de la pantalla que los dibuja.
 *
 * ── El truco del emoji de reserva ────────────────────────────────────────
 *
 * Cada sello tiene `imagen` y `emoji`. Mientras no exista la ilustración,
 * `imagen` va en `null` y se dibuja el emoji. El día que llegue el arte, se
 * llena `imagen` y **nada más cambia**: ni un componente, ni una prueba, ni la
 * base de datos.
 *
 * Eso permite construir hoy con emojis feos y estrenar arte bonito mañana sin
 * volver a tocar la lógica. Es lo mismo que hacen las plantillas de actividad
 * con el material: separar lo que se ve de lo que funciona.
 *
 * ── La regla de los sellos ───────────────────────────────────────────────
 *
 * Los sellos de los noventa que inspiran esto tenían mitad de premio y mitad
 * de castigo: "no trabaja", "impuntual", "desaseo". Aquí **todos premian**.
 *
 * No es remilgo: el sello aparece en el pizarrón de la persona, y en un salón
 * los demás lo pueden ver. Un sello de castigo delante del grupo, a un adulto
 * que además pagó por estar ahí, no corrige nada — solo humilla y hace que la
 * próxima vez prefiera no participar. Si alguien va mal, eso se dice en
 * privado, no se estampa.
 */

// ── El arte (Paola, 18 nov 2026) ─────────────────────────────────────────
// Versiones .webp optimizadas (5-60 KB). Los PNG originales, pesados, viven
// fuera del repo en `arte-original/` (ignorada en git) por si hay que
// volver a exportar.
import imgExcelente    from './sellos/excelente.webp'
import imgVolando      from './sellos/volando.webp'
import imgVeloz        from './sellos/veloz.webp'
import imgAcertado     from './sellos/acertado.webp'
import imgBuenaIdea    from './sellos/buenaidea.webp'
import imgTrabajadora  from './sellos/trabajadora.webp'
import imgDisciplinado from './sellos/disciplinado.webp'
import imgAprendiendo  from './sellos/aprendiendo.webp'
import imgCreciendo    from './sellos/creciendo.webp'
import imgReflejos     from './sellos/reflejos.webp'
import imgDiamante     from './sellos/diamante.webp'

import imgEncanta  from './reacciones/encanta.webp'
import imgCorazon  from './reacciones/corazon.webp'
import imgSorpresa from './reacciones/sorpresa.webp'
import imgRisa     from './reacciones/risa.webp'
import imgPensando from './reacciones/pensando.webp'
import imgPulgar   from './reacciones/pulgar.webp'
import imgBeso     from './reacciones/beso.webp'
import imgOk       from './reacciones/ok.webp'
import imgGenial   from './reacciones/genial.webp'
import imgMano     from './reacciones/mano.webp'

/**
 * Los sellos que la profe puede plantar.
 *
 * `id` es lo único que viaja y se guarda: el nombre y el dibujo pueden cambiar
 * mil veces sin invalidar los sellos que ya se repartieron.
 *
 * `frase` es lo que aparece EN GRANDE, con la animación, en el pizarrón de
 * quien lo recibe — corta y con emoción, como la diría la profe en voz alta.
 * `mensaje` la acompaña abajo y celebra algo concreto: "te salió" dice más
 * que "correcto". Las dos en neutro, que no le hablen solo a ellas o a ellos.
 */
export const SELLOS = [
    {
        id:      'excelente',
        nombre:  'Excelente',
        emoji:   '⭐',
        imagen:  imgExcelente,
        frase:   '¡Excelente trabajo!',
        mensaje: 'Te quedó impecable',
        color:   '#7C3AED',
    },
    {
        id:      'volando',
        nombre:  'Vas volando',
        emoji:   '🚀',
        imagen:  imgVolando,
        frase:   '¡Vas volando!',
        mensaje: 'Sigue así, nadie te alcanza',
        color:   '#6366F1',
    },
    {
        id:      'veloz',
        nombre:  'Súper veloz',
        emoji:   '⚡',
        imagen:  imgVeloz,
        frase:   '¡Qué velocidad!',
        mensaje: 'Lo resolviste en un instante',
        color:   '#0891B2',
    },
    {
        id:      'acertado',
        nombre:  'Diste en el blanco',
        emoji:   '🎯',
        imagen:  imgAcertado,
        frase:   '¡Diste en el blanco!',
        mensaje: 'Justo la respuesta que era',
        color:   '#BE123C',
    },
    {
        id:      'buenaidea',
        nombre:  'Buena idea',
        emoji:   '💡',
        imagen:  imgBuenaIdea,
        frase:   '¡Qué buena idea!',
        mensaje: 'Se te ocurrió algo que nadie había visto',
        color:   '#D97706',
    },
    {
        id:      'trabajadora',
        nombre:  'Abejita trabajadora',
        emoji:   '🐝',
        imagen:  imgTrabajadora,
        frase:   '¡Abejita trabajadora!',
        mensaje: 'No paraste en toda la actividad',
        color:   '#2563EB',
    },
    {
        id:      'disciplinado',
        nombre:  'Hormiguita constante',
        emoji:   '🐜',
        imagen:  imgDisciplinado,
        frase:   '¡Qué constancia!',
        mensaje: 'Paso a paso, de principio a fin',
        color:   '#DC2626',
    },
    {
        id:      'aprendiendo',
        nombre:  'Búho sabio',
        emoji:   '🦉',
        imagen:  imgAprendiendo,
        frase:   '¡Cada vez sabes más!',
        mensaje: 'Te tomaste tu tiempo para entenderlo',
        color:   '#B45309',
    },
    {
        id:      'creciendo',
        nombre:  'Vas creciendo',
        emoji:   '🌱',
        imagen:  imgCreciendo,
        frase:   '¡Estás creciendo!',
        mensaje: 'Se nota todo lo que has avanzado',
        color:   '#059669',
    },
    {
        id:      'reflejos',
        nombre:  'Buenos reflejos',
        emoji:   '🛡️',
        imagen:  imgReflejos,
        frase:   '¡Buenos reflejos!',
        mensaje: 'Cachaste el detalle a tiempo',
        color:   '#1D4ED8',
    },
    {
        id:      'diamante',
        nombre:  'Diamante',
        emoji:   '💎',
        imagen:  imgDiamante,
        frase:   '¡Brillaste!',
        mensaje: 'Eres un diamante en esta clase',
        color:   '#0EA5E9',
    },
]

/**
 * Las reacciones que un alumno manda en clase. Mismo trato que los sellos.
 *
 * Al mandarla, la carita CAE sobre la ventana de la profe en la pantalla de
 * todos (ver `LluviaReacciones` en `Aula.jsx`) y se queda unos segundos en el
 * avatar de quien la mandó, para saber de quién fue.
 */
export const REACCIONES = [
    { id: 'encanta',  emoji: '🤩', imagen: imgEncanta,  nombre: 'Me encanta' },
    { id: 'corazon',  emoji: '❤️', imagen: imgCorazon,  nombre: 'Con amor' },
    { id: 'risa',     emoji: '😄', imagen: imgRisa,     nombre: 'Jaja' },
    { id: 'sorpresa', emoji: '😮', imagen: imgSorpresa, nombre: 'No manches' },
    { id: 'pensando', emoji: '🤔', imagen: imgPensando, nombre: 'Déjame pensar' },
    { id: 'pulgar',   emoji: '👍', imagen: imgPulgar,   nombre: 'Va' },
    { id: 'ok',       emoji: '👌', imagen: imgOk,       nombre: 'Perfecto' },
    { id: 'genial',   emoji: '😎', imagen: imgGenial,   nombre: 'Lo tengo' },
    { id: 'beso',     emoji: '😘', imagen: imgBeso,     nombre: 'Besito' },
]

/**
 * La mano levantada. NO es una reacción: no cae ni se borra sola — se queda
 * en el avatar hasta que la profe le da la palabra (o la persona la baja).
 */
export const MANO = { id: 'mano', emoji: '✋', imagen: imgMano, nombre: 'Levantar la mano' }

/** Busca un sello por id. Devuelve null si ya no existe (sello retirado). */
export const selloPorId = (id) => SELLOS.find(s => s.id === id) ?? null

/** Busca una reacción por id. */
export const reaccionPorId = (id) => REACCIONES.find(r => r.id === id) ?? null

/**
 * Cuántos sellos caben en el pizarrón antes de amontonarse.
 *
 * Los de más no se pierden: siguen contando en el perfil y en el Habitat, que
 * es donde se van a ver bonitos de verdad. Aquí solo se muestran los últimos,
 * porque el pizarrón es para trabajar, no para presumir.
 */
export const SELLOS_VISIBLES_EN_PIZARRON = 6
