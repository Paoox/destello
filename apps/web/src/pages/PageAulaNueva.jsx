/**
 * Destello — Salón de ensayo del profesor
 *
 * Ruta: `/aula-nueva/:id` (entra como profe) · `/aula-nueva/:id?rol=alumno`
 * para verla del otro lado.
 *
 * POR QUÉ EXISTE (reconvertida el 26 ago 2026, ver project_onboarding): nació
 * como pantalla de prueba del aula nueva sin romper el `/aula/:id` real, y
 * sigue sirviendo exactamente para eso — pero su uso principal ahora es que
 * el profesor practique ANTES de su clase real: liberar y bloquear controles,
 * poner sellos, dar la palabra, cambiar de actividad, hasta que le salga
 * natural. Las 20 personas de abajo son alumnos de mentiras para practicar
 * con ellos, no una clase vacía — y todavía no hace falta el servidor de
 * video para ensayar nada de esto.
 *
 * Este archivo es el ÚNICO que conoce a Destello. Su trabajo es armar el objeto
 * `sesion` que describe `aula/contrato.js` y pasárselo al aula. El día que la
 * sesión venga de la API real, se cambia solo aquí; el día que otra escuela
 * monte el aula, escribe su propia versión de este archivo. Nada dentro de
 * `src/aula/` se entera.
 */
import { useParams, useSearchParams } from 'react-router-dom'
import Aula from '../aula/Aula.jsx'
import { MARCA_DESTELLO } from '../aula/contrato.js'

/** Aviso fijo de que esto es el salón de ensayo, no una clase real. */
function AvisoEnsayo({ rol }) {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 'var(--space-2)', padding: '6px 12px',
            background: 'var(--color-ambar-600, #D97706)', color: '#1a1204',
            fontSize: '13px', fontWeight: 600, textAlign: 'center',
        }}>
            🎓 Salón de ensayo — practica aquí antes de tu clase real. Nadie más te ve.
            {rol === 'alumno' && ' (viendo como lo vería un alumno)'}
        </div>
    )
}

/** Gente de mentiras para poder ver el aula antes de que exista la de verdad. */
const NOMBRES = [
    'Ana Ruiz', 'Beto Luna', 'Camila Soto', 'Diana Pérez', 'Emilio Vega',
    'Fer Nava', 'Gaby Ríos', 'Hugo Mena', 'Irene Cruz', 'Javier Toro',
    'Karla Díaz', 'Luis Ortiz', 'Mara Solís', 'Nico Bravo', 'Olga Ponce',
    'Pablo Reyes', 'Quetzal Mora', 'Rosa Iglesias', 'Sam Cárdenas', 'Tania Ávila',
]

/**
 * Se genera con una fórmula y no al azar: así la pantalla se ve igual en cada
 * recarga y se puede comparar un cambio con el anterior. Con datos aleatorios
 * nunca sabes si lo que cambió fue tu código o la suerte.
 */
const PERSONAS = NOMBRES.map((nombre, i) => ({
    id:       `p${i}`,
    nombre,
    avatarUrl: null,
    camara:   false,
    // Todos entran silenciados (ENTRAN_SILENCIADOS). Solo Diana tiene la
    // palabra ahora mismo: levantó la mano y la profe se la dio.
    micro:    i === 3,
    silenciadoPorProfe: i !== 3,
    manoArriba:    i === 2 || i === 11,
    reaccion:      i === 5 ? 'aplauso' : i === 14 ? 'duda' : null,
    interactuando: i % 4 !== 1,
    avance:   (i * 17) % 100,
    insignias: i % 5 === 0 ? ['trabajadora'] : i % 7 === 0 ? ['pensativo', 'excelente'] : [],
    // Cada quien va por donde va. `ultimoCambio` alimenta el semáforo.
    estadoActividad: {
        pasos: i % 3 === 0 ? { q1: 'a' } : i % 3 === 1 ? {} : { q1: 'a', q2: 'b' },
        ultimoCambio: i % 4 === 1 ? Date.now() - 9 * 60_000 : Date.now(),
    },
}))

export default function PageAulaNueva() {
    const { id } = useParams()
    const [params] = useSearchParams()
    // Default = profe: el uso principal de este salón es que ELLA ensaye.
    // ?rol=alumno queda para cuando quiera ver cómo se ve del otro lado.
    const rol = params.get('rol') === 'alumno' ? 'alumno' : 'profe'

    const yo = rol === 'profe'
        ? { id: 'profe', nombre: 'Prof. Minerva', avatarUrl: null, camara: true,
            micro: true, silenciadoPorProfe: false, manoArriba: false,
            reaccion: null, interactuando: true, avance: 0, insignias: [] }
        : { id: 'yo', nombre: 'Paola Arreola', avatarUrl: null, camara: false,
            micro: false, silenciadoPorProfe: true, manoArriba: false,
            reaccion: null, interactuando: true, avance: 42,
            insignias: ['trabajadora', 'excelente'] }

    // ── El material precargado de la clase ────────────────────────────────
    //
    // Esto es lo que un día va a venir de la PLANTILLA del taller, cargada
    // desde la API. Hoy está aquí para poder ver el aula funcionando.
    //
    // ⚠️ Las preguntas son de EJEMPLO y son de anatomía básica del oído — no de
    // tratamiento. El contenido real lo escribe y lo valida la profesora; el
    // código nunca inventa material de clase.
    const MATERIALES = [
        {
            id:     'quiz-oreja',
            tipo:   'quiz',
            nombre: 'Quiz · partes del oído',
            contenido: {
                preguntas: [
                    {
                        id: 'q1',
                        texto: '¿Cómo se llama el borde curvo que rodea la parte de arriba de la oreja?',
                        opciones: [
                            { id: 'a', texto: 'Hélix', correcta: true },
                            { id: 'b', texto: 'Lóbulo' },
                            { id: 'c', texto: 'Trago' },
                        ],
                    },
                    {
                        id: 'q2',
                        texto: '¿Qué parte de la oreja no tiene cartílago?',
                        opciones: [
                            { id: 'a', texto: 'El trago' },
                            { id: 'b', texto: 'El lóbulo', correcta: true },
                            { id: 'c', texto: 'La concha' },
                        ],
                    },
                    {
                        id: 'q3',
                        texto: '¿Cómo se llama la pequeña prominencia que está junto al conducto auditivo?',
                        opciones: [
                            { id: 'a', texto: 'Antihélix' },
                            { id: 'b', texto: 'Hélix' },
                            { id: 'c', texto: 'Trago', correcta: true },
                        ],
                    },
                ],
            },
        },
        { id: 'modelo-oreja', tipo: 'modelo3d', nombre: 'Modelo 3D · oreja', contenido: {} },
        { id: 'memorama-1',   tipo: 'memorama', nombre: 'Memorama · puntos',  contenido: {} },
    ]

    const sesion = {
        marca: MARCA_DESTELLO,
        taller: {
            nombre:     'Taller Auriculoterapia Inicial',
            instructor: 'Prof. Minerva Márquez',
            tema:       'Horizonte Zen',
            terminaEn:  147,      // minutos — el contador de la barra
        },
        rol,
        yo,
        // La profe se ve a sí misma en la lista; el alumno no se duplica.
        personas: rol === 'profe' ? PERSONAS : PERSONAS.slice(1),
        pizarron: {
            materiales:  MATERIALES,
            actividadId: 'quiz-oreja',   // la profe ya la puso en el pizarrón
            liberado:    true,           // y ya los dejó trabajar
        },
    }

    return (
        <>
            <AvisoEnsayo rol={rol} />
            <Aula sesion={sesion} key={`${id}-${rol}`} />
        </>
    )
}
