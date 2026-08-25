/**
 * Destello — El aula: el contrato con el mundo de afuera
 *
 * ⚠️ REGLA QUE NO SE ROMPE ⚠️
 *
 * El aula NO es una pantalla de Destello: es un producto aparte que un día se
 * va a rentar a escuelas, empresas y otras plataformas, con la marca de quien
 * la contrate.
 *
 * Por eso **nada dentro de `src/aula/` puede consultar la API de Destello, ni
 * leer `usuarios`, `talleres` o `chispas`.** El aula recibe TODO lo que
 * necesita saber en un solo objeto —el que describe este archivo— y quien la
 * monta se encarga de llenarlo.
 *
 * Hoy quien lo llena es Destello. Mañana puede ser el sistema de otra escuela,
 * y el aula no se entera ni le importa.
 *
 * Si algún día alguien necesita un dato que no está aquí, la respuesta correcta
 * es **agregarlo al contrato**, nunca ir a buscarlo por su cuenta. En el momento
 * en que un componente del aula haga `fetch('/api/...')`, el producto dejó de
 * ser vendible y volver atrás cuesta rehacerlo.
 */

/**
 * @typedef {Object} Marca
 * Todo lo que hace que el aula se vea de quien la contrató. Marca blanca.
 * @property {string}  nombre        Cómo se llama la escuela ("Destello")
 * @property {string?} logoUrl       Su logo. Si falta, se usa el símbolo ✦
 * @property {string}  colorPrimario Su color de acento
 */

/**
 * @typedef {Object} Persona
 * @property {string}  id
 * @property {string}  nombre    Nombre o alias — lo que la persona eligió que
 *                               se vea. NUNCA se muestra una inicial sola.
 * @property {string?} avatarUrl Su imagen. Si falta, se dibuja un avatar con
 *                               su nombre.
 * @property {boolean} camara    ¿Está transmitiendo video ahora?
 * @property {boolean} micro     ¿Tiene el micrófono abierto?
 * @property {boolean} silenciadoPorProfe  El silencio de la profe gana: si
 *                               esto es `true`, la persona no puede hablar
 *                               aunque le dé a su botón.
 *                               ⚠️ Entra en `true` para TODOS al empezar la
 *                               clase — ver ENTRAN_SILENCIADOS abajo.
 * @property {boolean} manoArriba
 * @property {string?} reaccion  Emoji que acaba de mandar, o null
 * @property {boolean} interactuando  El semáforo: ¿tocó el pizarrón en los
 *                               últimos minutos?
 * @property {number}  avance    0 a 100 — qué tan avanzada va en la actividad
 * @property {string[]} insignias Sellos que le ha puesto la profe hoy
 */

/**
 * @typedef {Object} Sesion
 * El objeto que el aula recibe. Es su única ventana al mundo.
 *
 * @property {Marca}   marca
 * @property {Object}  taller
 * @property {string}  taller.nombre
 * @property {string}  taller.instructor
 * @property {string?} taller.tema      Nombre del fondo/ambiente ("Horizonte Zen")
 * @property {number}  taller.terminaEn Minutos que faltan para que acabe
 * @property {'alumno'|'profe'} rol     Desde qué lado se ve el aula
 * @property {Persona} yo
 * @property {Persona[]} personas       Todos los demás
 * @property {Object}  pizarron
 * @property {string?} pizarron.actividadId  Qué se está mostrando
 * @property {boolean} pizarron.liberado     ¿Pueden tocarlo los alumnos?
 */

/** Marca por defecto, para cuando el aula se monta sin configurar nada. */
export const MARCA_DESTELLO = {
    nombre:        'Destello',
    logoUrl:       null,
    colorPrimario: 'var(--color-jade-500)',
}

/**
 * Los sellos y las reacciones NO viven aquí: viven en `catalogo.js`.
 *
 * Se movieron el 25 ago 2026 porque son **contenido**, no contrato. Paola va a
 * mandar a hacer las ilustraciones y las va a querer cambiar sin tocar código,
 * y cada uno necesita más que un emoji: nombre, mensaje, color e imagen.
 *
 * Tenerlos en dos lados sería garantizar que un día se desincronicen.
 */

export const MINUTOS_SIN_TOCAR = 3

/**
 * Todos entran a la clase SILENCIADOS.
 *
 * Decisión de Paola (25 ago 2026), y es de las que definen cómo se siente el
 * salón: *"no quiero que la gente interrumpa nomás porque sí"*.
 *
 * Con 20 personas conectadas desde su casa, el micrófono abierto por defecto no
 * es participación: es el perro del vecino, la tele de al lado y alguien que se
 * olvidó de que estaba en vivo. El costo de eso lo paga toda la clase.
 *
 * Así que el silencio no es castigo, es el estado normal. Hablar es algo que
 * se pide —levantando la mano— y que la profe concede. Igual que en un salón.
 *
 * Quien tenga la palabra la conserva hasta que la profe se la quite.
 */
export const ENTRAN_SILENCIADOS = true
