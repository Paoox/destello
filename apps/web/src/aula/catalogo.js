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

/**
 * Los sellos que la profe puede plantar.
 *
 * `id` es lo único que viaja y se guarda: el nombre y el dibujo pueden cambiar
 * mil veces sin invalidar los sellos que ya se repartieron.
 *
 * `mensaje` es lo que ve la persona cuando lo recibe. Se escribe en segunda
 * persona y celebra algo concreto — "te salió" dice más que "correcto".
 */
export const SELLOS = [
    {
        id:      'trabajadora',
        nombre:  'Abejita trabajadora',
        emoji:   '🐝',
        imagen:  null,
        mensaje: 'No paraste en toda la actividad',
        color:   '#D97706',
    },
    {
        id:      'pensativo',
        nombre:  'Osito pensativo',
        emoji:   '🧸',
        imagen:  null,
        mensaje: 'Te tomaste tu tiempo para entenderlo',
        color:   '#B45309',
    },
    {
        id:      'excelente',
        nombre:  'Excelente',
        emoji:   '⭐',
        imagen:  null,
        mensaje: 'Te quedó impecable',
        color:   '#F59E0B',
    },
    {
        id:      'volando',
        nombre:  'Vas volando',
        emoji:   '🚀',
        imagen:  null,
        mensaje: 'Terminaste antes que nadie',
        color:   '#7C3AED',
    },
    {
        id:      'buenaidea',
        nombre:  'Buena idea',
        emoji:   '💡',
        imagen:  null,
        mensaje: 'Se te ocurrió algo que nadie había visto',
        color:   '#0891B2',
    },
    {
        id:      'cariño',
        nombre:  'Con cariño',
        emoji:   '💚',
        imagen:  null,
        mensaje: 'Se nota que le pusiste corazón',
        color:   '#059669',
    },
    {
        id:      'valiente',
        nombre:  'Te aventaste',
        emoji:   '🦁',
        imagen:  null,
        mensaje: 'Participaste aunque no estabas segura',
        color:   '#DC2626',
    },
    {
        id:      'compañera',
        nombre:  'Buena compañera',
        emoji:   '🤝',
        imagen:  null,
        mensaje: 'Ayudaste a alguien más',
        color:   '#2563EB',
    },
]

/** Las reacciones que un alumno manda en clase. Mismo trato que los sellos. */
export const REACCIONES = [
    { id: 'aplauso',  emoji: '👏', imagen: null, nombre: 'Aplauso' },
    { id: 'corazon',  emoji: '💚', imagen: null, nombre: 'Me encanta' },
    { id: 'sorpresa', emoji: '😮', imagen: null, nombre: 'No manches' },
    { id: 'risa',     emoji: '😄', imagen: null, nombre: 'Jaja' },
    { id: 'duda',     emoji: '🤔', imagen: null, nombre: 'No entendí' },
    { id: 'pulgar',   emoji: '👍', imagen: null, nombre: 'Va' },
]

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
