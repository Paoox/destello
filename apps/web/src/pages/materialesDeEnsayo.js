/**
 * Destello — Material de ensayo del aula (`/aula-nueva`)
 *
 * Esto es lo que un día va a venir de la PLANTILLA de cada taller, cargada
 * desde la API. Hoy vive aquí para poder ver y probar cada actividad en el
 * salón de ensayo sin backend.
 *
 * ⚠️ El código nunca inventa material de clase: todo lo de aquí viene de los
 * prototipos de Paola (`mini-juegos/`, solo local) o son preguntas básicas de
 * anatomía marcadas como ejemplo. El contenido real lo escribe y lo valida la
 * profesora.
 */

const OREJA = '/contenido/auriculoterapia'

// La oreja 3D es "Human Ear Model" de ssavish274 en Sketchfab, licencia
// CC BY 4.0: se puede usar (también en clases pagadas) dando crédito al autor.
// Por eso el visor lo muestra en una esquina. Venía en los metadatos del .glb.
const CREDITO_OREJA = {
    texto: 'Modelo: Human Ear Model · ssavish274 · CC BY 4.0',
    url:   'https://sketchfab.com/3d-models/human-ear-model-e1f0f4b6fae54d59bdc3c6b2534eb411',
}

/* ── Lo que aparece en el menú de materiales ─────────────────────────── */

/**
 * Caso clínico de insomnio sobre la oreja 3D — textos, opciones y coordenadas
 * tal cual venían en el juego de decisiones de Paola
 * (`mini-juegos/desiciones_auriculoterapia`).
 */
const CASO_INSOMNIO = {
    id:     'caso-insomnio',
    tipo:   'caso',
    nombre: 'Caso clínico · insomnio (oreja 3D)',
    contenido: {
        titulo: "Reto clínico: tratamiento de insomnio",
        introduccion: "Tu paciente Roberto, 42 años, padece insomnio de conciliación y ansiedad clínica. Selecciona la prescripción exacta de 7 auriculopuntos de precisión para armonizar el Sistema Nervioso y pacificar el Shen.",
        datos: [
            {
                etiqueta: "Síntoma clave",
                valor: "Insomnio y agitación"
            },
            {
                etiqueta: "Diagnóstico MTC",
                valor: "Fuego de Corazón / Viento"
            },
            {
                etiqueta: "Tratamiento",
                valor: "7 auriculopuntos"
            }
        ],
        modelo: { url: `${OREJA}/modelos/oreja.glb`, credito: CREDITO_OREJA },
        marcadores: [
            {
                id: "semilla",
                nombre: "Semilla de vaccaria"
            },
            {
                id: "oro",
                nombre: "Balín de oro"
            },
            {
                id: "plata",
                nombre: "Balín de plata"
            }
        ],
        pasos: [
            {
                id: "p1",
                titulo: "Punto Ansiolítico Principal",
                pregunta: "¿Qué punto principal seleccionarás para calmar el Shen y la ansiedad?",
                descripcion: "Sopesa la resonancia neurofisiológica en la fosa triangular.",
                opciones: [
                    {
                        id: "shenmen",
                        titulo: "Punto Shen Men",
                        descripcion: "Ubicado en el vértice superior de la fosa triangular; modula la actividad cortical y sedación profunda.",
                        correcta: true,
                        punto: { x: 46, y: 22 }
                    },
                    {
                        id: "subcortex",
                        titulo: "Punto Subcórtex",
                        descripcion: "Ubicado en la pared interna del antitrago; regula la excitación del tálamo cerebral.",
                        punto: { x: 44, y: 68 }
                    },
                    {
                        id: "higado",
                        titulo: "Punto Hígado",
                        descripcion: "Ubicado en la concha cava posterior; estimula la libre circulación de Qi.",
                        punto: { x: 58, y: 56 }
                    }
                ]
            },
            {
                id: "p2",
                titulo: "Regulador Neurovegetativo",
                pregunta: "¿Cuál es el punto autonómico clave para equilibrar el Parasimpático?",
                descripcion: "Necesitas reducir el tono simpático acelerado que impide conciliar el sueño.",
                opciones: [
                    {
                        id: "estomago",
                        titulo: "Punto Estómago",
                        descripcion: "Ubicado en el origen de la raíz del hélix.",
                        punto: { x: 38, y: 48 }
                    },
                    {
                        id: "simpatico",
                        titulo: "Punto Simpático Autónomo",
                        descripcion: "Ubicado en la intersección de la rama inferior del antihélix; relaja el músculo liso e inhibe el estrés.",
                        correcta: true,
                        punto: { x: 62, y: 32 }
                    },
                    {
                        id: "corazon",
                        titulo: "Punto Corazón",
                        descripcion: "Ubicado en la depresión central de la concha cava.",
                        punto: { x: 46, y: 52 }
                    }
                ]
            },
            {
                id: "p3",
                titulo: "Anclaje Cerebral e Hipnótico",
                pregunta: "¿Qué estructura regula los ciclos de vigilia y el tálamo?",
                descripcion: "Determina el centro reflejo que equilibra el insomnio persistente nocturno.",
                opciones: [
                    {
                        id: "subcortex_talamo",
                        titulo: "Punto Subcórtex (Tálamos)",
                        descripcion: "Ubicado en la pared interna del antitrago; equilibra la corteza cerebral e inhibe el insomnio.",
                        correcta: true,
                        punto: { x: 44, y: 68 }
                    },
                    {
                        id: "bazo",
                        titulo: "Punto Bazo",
                        descripcion: "Ubicado en la concha cava superior; fortalece la digestión del alimento.",
                        punto: { x: 56, y: 44 }
                    },
                    {
                        id: "rinon",
                        titulo: "Punto Riñón",
                        descripcion: "Ubicado en la concha cymba debajo de la cruz del antihélix.",
                        punto: { x: 50, y: 38 }
                    }
                ]
            },
            {
                id: "p4",
                titulo: "Modulador Hormonal y Melatonina",
                pregunta: "¿Qué área auricular armoniza el eje endocrino y la secreción de melatonina?",
                descripcion: "Buscamos regular la secreción del cortisol nocturno.",
                opciones: [
                    {
                        id: "vejiga",
                        titulo: "Punto Vejiga",
                        descripcion: "Ubicado en la concha cymba; drena humedad en el canal.",
                        punto: { x: 52, y: 34 }
                    },
                    {
                        id: "endocrino",
                        titulo: "Punto Endocrino",
                        descripcion: "Ubicado en la escotadura intertrágica; equilibra hormonas y la melatonina para la inducción al sueño.",
                        correcta: true,
                        punto: { x: 38, y: 62 }
                    },
                    {
                        id: "intestino",
                        titulo: "Punto Intestino Delgado",
                        descripcion: "Ubicado en la concha cymba superior.",
                        punto: { x: 54, y: 40 }
                    }
                ]
            },
            {
                id: "p5",
                titulo: "Punto Específico de Insomnio",
                pregunta: "¿Cuál es el punto de soporte directo para pacificar el descanso profundo?",
                descripcion: "Selecciona el mapa reflexológico enfocado específicamente en trastornos del sueño.",
                opciones: [
                    {
                        id: "insomnio1",
                        titulo: "Punto Insomnio 1 / 2",
                        descripcion: "Ubicado en la zona céntrica del lóbulo auricular; indicado específicamente para trastornos de vigilia.",
                        correcta: true,
                        punto: { x: 46, y: 86 }
                    },
                    {
                        id: "pulmon",
                        titulo: "Punto Pulmón",
                        descripcion: "Ubicado en la concha cava rodeando el corazón.",
                        punto: { x: 48, y: 58 }
                    },
                    {
                        id: "vesicula",
                        titulo: "Punto Vesícula Biliar",
                        descripcion: "Ubicado en la concha cymba superior.",
                        punto: { x: 60, y: 42 }
                    }
                ]
            },
            {
                id: "p6",
                titulo: "Regulación de Agitación y Corazón",
                pregunta: "¿Qué punto disipa el Fuego de Corazón que provoca agitación nocturna?",
                descripcion: "El paciente relata palpitaciones breves e hiperactividad mental al recostarse.",
                opciones: [
                    {
                        id: "triple_calentador",
                        titulo: "Punto Triple Calentador",
                        descripcion: "Ubicado cerca de la escotadura intertrágica posterior.",
                        punto: { x: 42, y: 58 }
                    },
                    {
                        id: "corazon_shen",
                        titulo: "Punto Corazón (Concha Cava)",
                        descripcion: "Ubicado en el centro cavitario de la concha cava; alberga el Shen y pacifica el espíritu inquieto.",
                        correcta: true,
                        punto: { x: 46, y: 52 }
                    },
                    {
                        id: "pericardio",
                        titulo: "Punto Pericardio",
                        descripcion: "Ubicado cerca del antitrago; protege al corazón.",
                        punto: { x: 40, y: 55 }
                    }
                ]
            },
            {
                id: "p7",
                titulo: "Punto Maestro de Cierre",
                pregunta: "¿Con qué punto maestro sellarás y armonizarás el tratamiento completo?",
                descripcion: "Punto integrador universal que potencia el equilibrio neurovegetativo global.",
                opciones: [
                    {
                        id: "occipucio",
                        titulo: "Punto Occipucio",
                        descripcion: "Ubicado en la cara externa del antitrago.",
                        punto: { x: 52, y: 66 }
                    },
                    {
                        id: "faringe",
                        titulo: "Punto Faringe",
                        descripcion: "Ubicado en la pared del tragus.",
                        punto: { x: 30, y: 52 }
                    },
                    {
                        id: "punto_cero",
                        titulo: "Punto Cero (Point Zero)",
                        descripcion: "Ubicado sobre la raíz del hélix; armoniza la energía general y estabiliza todos los demás puntos.",
                        correcta: true,
                        punto: { x: 36, y: 45 }
                    }
                ]
            }
        ],
        procesando: {
            titulo: "Aplicando estimulación auricular",
            texto: "Fijando microesferas y calibrando modulación neuro-vagal…"
        },
        resultados: [
            {
                minimo: 7,
                tono: "bien",
                insignia: "¡Tratamiento perfecto — dulce sueño!",
                titulo: "Roberto duerme plácidamente",
                descripcion: "¡Excelente precisión anatómica! Colocaste los 7 auriculopuntos exactos. La modulación neuro-vagal redujo el tono simpático y pacificó el Shen. Roberto ha conciliado un sueño reparador.",
                estado: "Restablecido / ensueño",
                video: `${OREJA}/caso-insomnio/dormido.mp4`
            },
            {
                minimo: 4,
                tono: "medio",
                insignia: "Tratamiento parcial — insomnio persistente",
                titulo: "Roberto sigue despierto a las 3:00 AM",
                descripcion: "Faltó precisión en algunos puntos clave. Aunque se redujo parte del estrés, el Fuego de Corazón no se pacificó por completo. Roberto continúa con insomnio e inquietud.",
                estado: "Despierto / cansado",
                video: `${OREJA}/caso-insomnio/despierto.mp4`
            },
            {
                minimo: 0,
                tono: "mal",
                insignia: "Fallo de prescripción — inquietud",
                titulo: "Roberto sigue muy agitado",
                descripcion: "La selección imprecisa de auriculopuntos no logró sedar el sistema nervioso autónomo. Se recomienda revisar la localización anatómica exacta de Shenmen, Punto Cero y Subcórtex.",
                estado: "Agitado / insomnio",
                video: `${OREJA}/caso-insomnio/agitado.mp4`
            }
        ]
    },
}

export const MATERIALES_DE_ENSAYO = [
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
    CASO_INSOMNIO,
    // La misma oreja del caso, solita, para explorarla con vuelta completa.
    // Los puntos (y sus coordenadas) son los del caso clínico de arriba.
    {
        id:     'oreja-3d',
        tipo:   'modelo3d',
        nombre: 'Oreja 3D · explorar',
        contenido: {
            titulo:      'La oreja en 3D',
            descripcion: 'Gírala con el dedo o el mouse y acércala. Toca un punto de la lista para ubicarlo.',
            modelo:      { url: `${OREJA}/modelos/oreja.glb`, credito: CREDITO_OREJA },
            puntos: [
                { id: 'shenmen',   nombre: 'Shen Men',    x: 46, y: 22, descripcion: 'Vértice superior de la fosa triangular; modula la actividad cortical y la sedación profunda.' },
                { id: 'rinon',     nombre: 'Riñón',       x: 50, y: 38, descripcion: 'Concha cymba, debajo de la cruz del antihélix.' },
                { id: 'estomago',  nombre: 'Estómago',    x: 38, y: 48, descripcion: 'En el origen de la raíz del hélix.' },
                { id: 'corazon',   nombre: 'Corazón',     x: 46, y: 52, descripcion: 'En la depresión central de la concha cava.' },
                { id: 'pulmon',    nombre: 'Pulmón',      x: 48, y: 58, descripcion: 'En la concha cava, rodeando al corazón.' },
                { id: 'endocrino', nombre: 'Endocrino',   x: 38, y: 62, descripcion: 'En la escotadura intertrágica; equilibra hormonas y la melatonina.' },
                { id: 'subcortex', nombre: 'Subcórtex',   x: 44, y: 68, descripcion: 'Pared interna del antitrago; regula la excitación del tálamo cerebral.' },
                { id: 'insomnio',  nombre: 'Insomnio 1 / 2', x: 46, y: 86, descripcion: 'Zona céntrica del lóbulo; indicado para trastornos de vigilia.' },
            ],
        },
    },
    memoramaOreja('memorama-oreja-1', 'Memorama · oreja 1', [
        ['helix',             'Hélix',              'Repliegue curvilíneo que forma el borde prominente del pabellón auricular'],
        ['antehelix',         'Antehélix',          'Elevación del cartílago paralela al hélix que se divide en su parte superior'],
        ['trago',             'Trago',              'Prominencia cartilaginosa que cubre parcialmente la entrada del conducto auditivo'],
        ['antitrago',         'Antitrago',          'Pequeña protuberancia en la base del antehélix, ubicada frente al trago'],
        ['lobulo',            'Lóbulo',             'Parte inferior y blanda de la oreja, formada por piel y grasa sin cartílago'],
    ]),
    memoramaOreja('memorama-oreja-2', 'Memorama · oreja 2', [
        ['concha-superior',   'Concha superior',    'Porción estrecha y superior de la cavidad central de la oreja'],
        ['concha-inferior',   'Concha inferior',    'Depresión profunda e inferior que conduce directamente al conducto auditivo'],
        ['fosa-escafoidea',   'Fosa escafoidea',    'Depresión alargada y estrecha situada entre el hélix y el antehélix'],
        ['foseta-triangular', 'Foseta triangular',  'Depresión en forma de triángulo ubicada en la parte superior entre las dos ramas del antehélix'],
        ['pabellon-auricular','Pabellón auricular', 'Representación gráfica de la anatomía externa del oído, dividida en zonas delimitadas para la localización exacta de puntos terapéuticos'],
    ]),
    {
        id:     'trivia-cultura',
        tipo:   'trivia',
        nombre: 'Trivia · cultura general (búho)',
        contenido: {
            titulo: 'Cultura general',
            segundosPorPregunta: 0,
            preguntas: [
            {
                id: "oceano", categoria: "Geografía",
                pregunta: "¿Cuál es el océano más grande del planeta Tierra?",
                opciones: [{ texto: "Océano Pacífico", correcta: true }, { texto: "Océano Atlántico" }, { texto: "Océano Índico" }],
                explicacion: "El Pacífico abarca más de 165 millones de km², cubriendo más del 30% de la superficie terrestre.",
            },
            {
                id: "luna", categoria: "Historia",
                pregunta: "¿En qué año llegó el ser humano a la Luna por primera vez?",
                opciones: [{ texto: "1969", correcta: true }, { texto: "1975" }, { texto: "1958" }],
                explicacion: "Neil Armstrong pisó la Luna el 20 de julio de 1969 durante la misión Apolo 11.",
            },
            {
                id: "hidrogeno", categoria: "Ciencia",
                pregunta: "¿Cuál es el elemento químico más abundante en el universo?",
                opciones: [{ texto: "Hidrógeno", correcta: true }, { texto: "Oxígeno" }, { texto: "Helio" }],
                explicacion: "El hidrógeno constituye aproximadamente el 75% de toda la materia del universo conocido.",
            },
            {
                id: "gioconda", categoria: "Arte & Pintura",
                pregunta: "¿Qué célebre artista pintó la obra maestra de La Gioconda (Mona Lisa)?",
                opciones: [{ texto: "Leonardo da Vinci", correcta: true }, { texto: "Vincent van Gogh" }, { texto: "Pablo Picasso" }],
                explicacion: "Leonardo da Vinci comenzó a pintar la Mona Lisa alrededor del año 1503 en Florencia, Italia.",
            },
            {
                id: "rusia", categoria: "Geografía",
                pregunta: "¿Cuál es el país más extenso del mundo por superficie territorial?",
                opciones: [{ texto: "Rusia", correcta: true }, { texto: "Canadá" }, { texto: "China" }],
                explicacion: "Rusia cuenta con más de 17 millones de kilómetros cuadrados, abarcando 11 husos horarios.",
            },
            {
                id: "cerebro", categoria: "Biología & Salud",
                pregunta: "¿Qué órgano del cuerpo humano consume la mayor cantidad de energía?",
                opciones: [{ texto: "El cerebro", correcta: true }, { texto: "El corazón" }, { texto: "El hígado" }],
                explicacion: "Aunque solo representa el 2% del peso corporal, el cerebro consume cerca del 20% de la glucosa y oxígeno del cuerpo.",
            },
            {
                id: "piramides", categoria: "Historia Antigua",
                pregunta: "¿En qué país actual se encuentran las famosas Pirámides de Guiza?",
                opciones: [{ texto: "Egipto", correcta: true }, { texto: "México" }, { texto: "Perú" }],
                explicacion: "Las pirámides están situadas en las afueras de El Cairo, Egipto, y son una de las Maravillas del Mundo Antiguo.",
            },
            {
                id: "quijote", categoria: "Literatura",
                pregunta: "¿Cuál es la obra literaria en español más famosa de Miguel de Cervantes?",
                opciones: [{ texto: "Don Quijote de la Mancha", correcta: true }, { texto: "Cien años de soledad" }, { texto: "La Galatea" }],
                explicacion: "Don Quijote de la Mancha fue publicada en 1605 y es una de las obras más importantes de la literatura universal.",
            },
            {
                id: "piano", categoria: "Música",
                pregunta: "¿Cuántas teclas posee un piano acústico estándar tradicional?",
                opciones: [{ texto: "88 teclas", correcta: true }, { texto: "76 teclas" }, { texto: "92 teclas" }],
                explicacion: "Un piano estándar tiene 88 teclas en total: 52 blancas (notas naturales) y 36 negras (alteraciones).",
            },
            {
                id: "osmio", categoria: "Química & Materiales",
                pregunta: "¿Cuál es el metal natural más denso y pesado descubierto en la Tierra?",
                opciones: [{ texto: "Osmio", correcta: true }, { texto: "Platino" }, { texto: "Plomo" }],
                explicacion: "El osmio tiene una densidad de aproximadamente 22.59 g/cm³, superando por poco al iridio.",
            },
            ],
        },
    },
    {
        id:     'sopa-oreja',
        tipo:   'sopa',
        nombre: 'Sopa de letras · partes de la oreja',
        contenido: {
            titulo: 'Partes de la oreja',
            instrucciones: 'Encuentra las estructuras del pabellón auricular escondidas en la sopa.',
            palabras: ['HÉLIX', 'ANTEHÉLIX', 'TRAGO', 'ANTITRAGO', 'LÓBULO', 'CONCHA', 'FOSETA', 'PABELLÓN'],
        },
    },
    {
        id:     'sopa-animales',
        tipo:   'sopa',
        nombre: 'Sopa de letras · animales',
        contenido: {
            titulo: 'Animales',
            instrucciones: 'Encuentra los 10 animales escondidos en la sopa.',
            cuantas: 10,
            palabras: ['LEÓN', 'TIGRE', 'PERRO', 'GATO', 'OSO', 'ZORRO', 'MONO', 'CEBRA', 'JIRAFA', 'LOBO',
                       'PANDA', 'VACA', 'PATO', 'RANA', 'KOALA', 'PUMA', 'LORO', 'ÁGUILA', 'CABALLO', 'OVEJA'],
        },
    },
    {
        id:     'crucigrama-muertos',
        tipo:   'crucigrama',
        nombre: 'Crucigrama · Día de Muertos',
        contenido: {
            titulo: 'Día de Muertos y Halloween',
            instrucciones: 'Lee cada pista y completa el crucigrama de temporada. Cada partida sale distinta.',
            cuantas: 5,
            palabras: [
            { palabra: "CATRINA", pista: "Elegante calavera mexicana vestida de gala." },
            { palabra: "OFRENDA", pista: "Altar para recordar a los seres queridos que ya partieron." },
            { palabra: "ALTAR", pista: "Mesa decorada con fotos, comida y velas para los difuntos." },
            { palabra: "CEMPASUCHI", pista: "Flor naranja brillante que guía a las almas." },
            { palabra: "CALAVERA", pista: "Representación dulce o literaria de la muerte." },
            { palabra: "BRUJA", pista: "Personaje mítico de Halloween con sombrero de pico y escoba." },
            { palabra: "FANTASMA", pista: "Espectro blanco flotante que asusta diciendo ¡Buu!" },
            { palabra: "CALABAZA", pista: "Fruta naranja tallada con rostro aterrador." },
            { palabra: "VAMPIRO", pista: "Ser nocturno con colmillos que le teme al ajo." },
            { palabra: "DISFRAZ", pista: "Atuendo especial para ocultar tu identidad en Halloween." },
            { palabra: "DULCES", pista: "Premios obtenidos durante el truco o trato." },
            { palabra: "TUMBA", pista: "Lugar de descanso eterno decorado en el panteón." },
            { palabra: "VELADORA", pista: "Vela en vaso que ilumina la noche de muertos." },
            { palabra: "MISTERIO", pista: "Secreto o enigma indescifrable en la oscuridad." },
            ],
        },
    },
]

/**
 * Un memorama de la oreja, de 5 parejas (10 cartas — se ve bien hasta en un
 * pizarrón chico; las 10 parejas se partieron en dos materiales).
 *
 * Textos e introducción tal cual venían en el memorama de prueba de Paola
 * (`mini-juegos/memorama_auri`); los dibujos de la oreja se recortaron de esas
 * mismas cartas, sin el texto horneado.
 */
function memoramaOreja(id, nombre, pares) {
    return {
        id,
        tipo: 'memorama',
        nombre,
        contenido: {
            titulo: 'Anatomía del pabellón auricular',
            instrucciones: '¡Bienvenido al desafío anatómico del pabellón auditivo! Explora las maravillas del sistema auditivo emparejando cada estructura anatómica con su función técnica exacta.',
            segundosParaMemorizar: 15,
            pares: pares.map(([parId, texto, descripcion]) => ({
                id: parId,
                a: { texto, imagen: `${OREJA}/oreja/${parId}.webp` },
                b: descripcion,
            })),
        },
    }
}
