/**
 * Destello — Actividad: Memorama
 *
 * Segunda actividad sobre el contrato. Igual que el Quiz, no sabe nada del
 * aula ni del tema: las parejas llegan en `contenido`. El mismo archivo sirve
 * para "parte de la oreja ↔ su descripción" y para "ingrediente ↔ para qué
 * sirve en las gomitas".
 *
 * ── Forma del contenido ──────────────────────────────────────────────────
 *
 *   {
 *     titulo: 'Anatomía del pabellón auricular',   // opcional
 *     instrucciones: '¡Bienvenido al desafío…!',   // opcional; si no, una genérica
 *     segundosParaMemorizar: 15,                   // opcional; 0 = sin vistazo
 *     pares: [
 *       { id: 'helix',
 *         a: { texto: 'Hélix', imagen: '/contenido/…/helix.webp' },
 *         b: 'Repliegue curvilíneo que forma el borde…' },
 *     ],
 *   }
 *
 * Cada lado (`a` / `b`) es un texto suelto o `{ texto, imagen }`:
 *   - con imagen y texto corto → carta ilustrada (dibujo grande, nombre abajo)
 *   - con imagen y texto largo → carta explicada (texto arriba, dibujo chico)
 *   - sin imagen               → carta de texto
 * **El texto nunca va horneado en la imagen**: así cualquier clase escribe sus
 * parejas sin mandar a diseñar cartas, y el texto se puede traducir.
 *
 * Recomendado: 5 parejas (10 cartas) por memorama — se ve bien hasta en un
 * pizarrón chico. Si un tema tiene más, se parte en dos materiales.
 *
 * ── Las pantallas ────────────────────────────────────────────────────────
 *
 *   Instrucciones → Tutorial (ejemplo + práctica con 2 parejas) → Juego → Fin
 *
 * El tutorial es del JUEGO, no del tema: enseña la mecánica con animales
 * (caballo, perro, gato), así que es el mismo para cualquier clase. Hay que
 * terminar la práctica para pasar al juego la primera vez; después (o si eres
 * la profe) se puede ir directo.
 *
 * ── Forma del estado ─────────────────────────────────────────────────────
 *
 *   { orden: ['helix-a', 'trago-b', …],  // cómo quedaron barajadas
 *     pasos: { helix: true, … },          // parejas encontradas
 *     intentos: 7,                        // parejas destapadas, buenas o no
 *     tutorialHecho: true,                // ya pasó por la práctica
 *     ultimoCambio }
 *
 * El orden se guarda en el estado (no se baraja en cada render) porque la profe
 * tiene que ver el MISMO tablero que la alumna cuando abre su pizarrón. Las
 * cartas destapadas en este momento NO viajan: son de un segundo, y mandarlas
 * llenaría el canal de datos para nada.
 *
 * ── Por qué no hay tiempo límite ni "perdiste" ───────────────────────────
 *
 * El juego original tenía 5 minutos y pantalla de derrota. En clase en vivo,
 * eso es el mismo tache delante del grupo que el Quiz evita a propósito: el
 * ritmo lo pone la profe, no un reloj. Lo que sí se conserva es el vistazo
 * inicial para memorizar (parte del juego, no un castigo) y la pista que
 * ilumina una pareja cuando alguien lleva varios fallos seguidos.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { marcarCambio } from './contrato.js'
import ornamento from './memorama/ornamento.webp'
import imgCaballo from './memorama/tutorial/caballo.webp'
import imgManzana from './memorama/tutorial/manzana.webp'
import imgPerro from './memorama/tutorial/perro.webp'
import imgPelotas from './memorama/tutorial/pelotas.webp'
import imgGato from './memorama/tutorial/gato.webp'
import imgPescado from './memorama/tutorial/pescado.webp'

/** Brillo de cada pareja ya encontrada — se reparten en orden y se repiten. */
const BRILLOS = ['#34d399', '#fbbf24', '#c084fc', '#f472b6', '#22d3ee', '#a3e635', '#fb923c', '#818cf8']

/** Fallos seguidos antes de que una pareja se ilumine sola. */
const FALLOS_PARA_PISTA = 5

/** El material del tutorial: siempre el mismo, sea cual sea el tema. */
const TUTORIAL = {
    ejemplo: {
        id: 'caballo',
        a: { texto: 'Caballo', imagen: imgCaballo },
        b: { texto: 'Relinchan y aman las manzanas', imagen: imgManzana },
    },
    pares: [
        { id: 'perro', a: { texto: 'Perro', imagen: imgPerro }, b: { texto: 'Ladra y ama las pelotas', imagen: imgPelotas } },
        { id: 'gato',  a: { texto: 'Gato',  imagen: imgGato },  b: { texto: 'Ronronea y ama el pescado', imagen: imgPescado } },
    ],
    segundosParaMemorizar: 8,
}

/** Un lado de la pareja, normalizado: siempre `{ texto, imagen }`. */
const lado = (v) => (typeof v === 'string' ? { texto: v, imagen: null } : { texto: v?.texto ?? '', imagen: v?.imagen ?? null })

/** Las cartas que salen de una lista de parejas, sin barajar. */
function cartasDe(pares) {
    return (pares ?? []).flatMap(p => [
        { id: `${p.id}-a`, par: p.id, ...lado(p.a) },
        { id: `${p.id}-b`, par: p.id, ...lado(p.b) },
    ])
}

/**
 * Las cartas en el orden guardado. Si el contenido cambió después de barajar
 * (la profe quitó o agregó una pareja), se tiran las que ya no existen y las
 * nuevas van al final: mejor un tablero un poco raro que uno roto en plena clase.
 */
function enOrden(cartas, orden) {
    const porId = new Map(cartas.map(c => [c.id, c]))
    const vistas = new Set()
    const res = []
    for (const id of orden ?? []) {
        const c = porId.get(id)
        if (c && !vistas.has(id)) { res.push(c); vistas.add(id) }
    }
    for (const c of cartas) if (!vistas.has(c.id)) res.push(c)
    return res
}

function barajar(lista) {
    const a = [...lista]
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
}

/** Resumen para la miniatura de la profe, sin montar el tablero. */
export function resumen(contenido, estado) {
    const pares = contenido?.pares ?? []
    if (!pares.length) return { avance: 0, etiqueta: 'sin parejas', terminado: false }
    const encontradas = pares.filter(p => estado?.pasos?.[p.id]).length
    return {
        avance:    Math.round((encontradas / pares.length) * 100),
        etiqueta:  !estado?.orden ? 'sin empezar' : `${encontradas} de ${pares.length} pares`,
        terminado: encontradas >= pares.length,
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   La actividad
   ══════════════════════════════════════════════════════════════════════════ */

export default function Memorama({ contenido, estado, onCambio, liberado, esProfe }) {
    const pares = contenido?.pares ?? []
    const cartas = useMemo(() => cartasDe(contenido?.pares), [contenido])
    const encontradas = estado?.pasos ?? {}
    const intentos = estado?.intentos ?? 0
    const empezado = Array.isArray(estado?.orden)
    const tablero = useMemo(() => enOrden(cartas, estado?.orden), [cartas, estado?.orden])
    const segundos = Math.max(0, Math.round(contenido?.segundosParaMemorizar ?? 0))

    const [fase, setFase] = useState('instrucciones')  // antes de jugar: 'instrucciones' | 'tutorial'
    const [verReglas, setVerReglas] = useState(false)  // releer las reglas a media partida
    const [memorizando, setMemorizando] = useState(0)  // segundos restantes del vistazo
    const [verTodas, setVerTodas] = useState(false)    // solo la profe
    const raiz = useRef(null)
    const rejilla = useRef(null)
    const espacio = useEspacio(raiz, rejilla)

    // El vistazo inicial: cuenta regresiva y luego se tapan todas.
    useEffect(() => {
        if (memorizando <= 0) return
        const t = setTimeout(() => setMemorizando(s => s - 1), 1000)
        return () => clearTimeout(t)
    }, [memorizando])

    if (!pares.length) {
        return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Este memorama todavía no tiene parejas.</p>
    }

    const total = pares.length
    const hechas = pares.filter(p => encontradas[p.id]).length
    const terminado = hechas >= total
    const toque = () => onCambio(marcarCambio(estado, {}))

    const empezar = (extra = {}) => {
        if (!liberado) return
        setVerReglas(false)
        onCambio(marcarCambio(estado, { orden: barajar(cartas.map(c => c.id)), pasos: {}, intentos: 0, ...extra }))
        setMemorizando(segundos)
    }

    const intento = (acierto, par) => {
        onCambio(marcarCambio(estado, {
            pasos: acierto ? { ...encontradas, [par]: true } : encontradas,
            intentos: intentos + 1,
        }))
    }

    const puedeSaltarTutorial = esProfe || estado?.tutorialHecho
    const { columnas, anchoCarta } = acomodo(tablero.length, espacio)

    let pantalla
    if (empezado && !verReglas) {
        pantalla = (
            <Tablero
                key={tablero.map(c => c.id).join('|')}
                cartas={tablero}
                pares={pares}
                encontradas={encontradas}
                bloqueado={!liberado || memorizando > 0}
                mostrarTodas={memorizando > 0 || verTodas}
                mensaje={memorizando > 0 ? `Memoriza dónde está cada carta… ${memorizando}` : null}
                columnas={columnas}
                anchoCarta={anchoCarta}
                rejillaRef={rejilla}
                onToque={toque}
                onIntento={intento}
                liberado={liberado}
            />
        )
    } else if (!empezado && fase === 'tutorial') {
        pantalla = (
            <Tutorial
                liberado={liberado}
                puedeSaltar={puedeSaltarTutorial}
                espacio={espacio}
                onToque={toque}
                onTerminar={() => empezar({ tutorialHecho: true })}
                onVolver={() => setFase('instrucciones')}
            />
        )
    } else {
        pantalla = (
            <Instrucciones
                contenido={contenido}
                total={total}
                segundos={segundos}
                liberado={liberado}
                aMedioJuego={verReglas}
                onComoJugar={() => { setFase('tutorial'); toque() }}
                onDirecto={puedeSaltarTutorial ? () => empezar() : null}
                onVolver={() => setVerReglas(false)}
            />
        )
    }

    return (
        <div ref={raiz} className="mem" style={{ opacity: liberado ? 1 : 0.55 }}>
            <style>{CSS}</style>

            <div className="mem-cabeza">
                {contenido?.titulo && <span className="mem-titulo">{contenido.titulo}</span>}
                {empezado && !verReglas && (
                    <span className="mem-cuenta">
                        {hechas}/{total} pares · {intentos} {intentos === 1 ? 'intento' : 'intentos'}
                    </span>
                )}
                {empezado && !verReglas && (
                    <button className="mem-boton mem-boton-sutil" onClick={() => setVerReglas(true)}>Reglas</button>
                )}
                {esProfe && empezado && !verReglas && (
                    <button className="mem-boton mem-boton-sutil" onClick={() => setVerTodas(v => !v)}>
                        {verTodas ? 'Tapar' : 'Ver todas'}
                    </button>
                )}
            </div>

            {empezado && !verReglas ? pantalla : <Ajustar espacio={espacio}>{pantalla}</Ajustar>}

            {empezado && !verReglas && terminado && (
                <div className="mem-fin">
                    <span>¡Encontraste las {total} parejas en {intentos} intentos!</span>
                    <button className="mem-boton" onClick={() => empezar()} disabled={!liberado}>Otra vez</button>
                </div>
            )}
        </div>
    )
}

/**
 * Encoge una pantalla de leer (reglas, tutorial) para que quepa completa en
 * el pizarrón. Mide la pantalla a su tamaño natural y, si es más alta que el
 * hueco, la escala hacia abajo — nunca la agranda. Debajo de `MIN` ya no se
 * lee bien, así que ahí prefiere dejar scroll.
 *
 * Se escala con `transform` (que no cambia el tamaño medido del contenido) y
 * se le da al envoltorio el alto ya escalado, para que no quede hueco abajo.
 */
function Ajustar({ espacio, children }) {
    const MIN = 0.62
    const contenido = useRef(null)
    const [alto, setAlto] = useState(0)

    useEffect(() => {
        const el = contenido.current
        if (!el) return
        const medir = () => setAlto(el.offsetHeight)
        medir()
        const ro = new ResizeObserver(medir)
        ro.observe(el)
        return () => ro.disconnect()
    }, [])

    // Lo que queda para la pantalla: el alto del pizarrón menos la cabeza de
    // la actividad y los márgenes (~80 px).
    const disponible = (espacio?.h ?? 0) - 80
    const escala = alto && disponible > 0 ? Math.max(MIN, Math.min(1, disponible / alto)) : 1

    return (
        <div style={{ width: '100%', height: alto ? alto * escala : 'auto' }}>
            <div ref={contenido} style={{ transform: `scale(${escala})`, transformOrigin: 'top center' }}>
                {children}
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Pantalla 1 — Instrucciones
   ══════════════════════════════════════════════════════════════════════════ */

function Instrucciones({ contenido, total, segundos, liberado, aMedioJuego, onComoJugar, onDirecto, onVolver }) {
    return (
        <div className="mem-panel">
            <span className="mem-insignia">⚡ Desafío interactivo</span>
            <h2 className="mem-gran-titulo">Probando memoria</h2>
            <p className="mem-intro">
                {contenido?.instrucciones
                    ?? 'Pon a prueba tu memoria emparejando cada concepto con su descripción.'}
            </p>

            <div className="mem-reglas">
                <h3>Reglas rápidas del juego</h3>
                <ul>
                    <li>
                        <strong>Emparejamiento:</strong> encontrarás {total * 2} cartas
                        ({total} pares de <em>nombre ⇄ descripción</em>).
                    </li>
                    {segundos > 0 && (
                        <li>
                            <strong>Fase de memorización:</strong> al iniciar, las cartas permanecerán
                            abiertas <strong>{segundos} segundos</strong> para que memorices su posición.
                        </li>
                    )}
                    <li>
                        <strong>A tu ritmo:</strong> no hay tiempo límite. Se cuentan tus intentos;
                        busca terminar en los menos posibles.
                    </li>
                    <li>
                        <strong>Pistas:</strong> si fallas {FALLOS_PARA_PISTA} veces seguidas, una
                        pareja se iluminará para ayudarte.
                    </li>
                </ul>
            </div>

            <div className="mem-acciones">
                {aMedioJuego ? (
                    <button className="mem-boton" onClick={onVolver}>Volver al juego</button>
                ) : (
                    <>
                        <button className="mem-boton" onClick={onComoJugar} disabled={!liberado}>¿Cómo jugar?</button>
                        {onDirecto && (
                            <button className="mem-boton mem-boton-sutil" onClick={onDirecto} disabled={!liberado}>
                                Ya sé jugar
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Pantalla 2 — Tutorial: un ejemplo de pareja y una práctica de 2 parejas
   ══════════════════════════════════════════════════════════════════════════ */

function Tutorial({ liberado, puedeSaltar, espacio, onToque, onTerminar, onVolver }) {
    const [ronda, setRonda] = useState(0)
    const cartas = useMemo(() => barajar(cartasDe(TUTORIAL.pares)), [ronda])
    const [encontradas, setEncontradas] = useState({})
    const [memorizando, setMemorizando] = useState(TUTORIAL.segundosParaMemorizar)

    useEffect(() => {
        if (memorizando <= 0) return
        const t = setTimeout(() => setMemorizando(s => s - 1), 1000)
        return () => clearTimeout(t)
    }, [memorizando])

    const lista = Object.keys(encontradas).length >= TUTORIAL.pares.length
    const ejemplo = cartasDe([TUTORIAL.ejemplo])
    // Ejemplo (2 cartas) y práctica (4 cartas) van lado a lado: el tamaño de
    // carta sale de repartir el ancho entre esas 6 más las etiquetas y
    // márgenes. En un pizarrón angosto se acomodan una debajo de la otra.
    const ancho = Math.max(56, Math.min(76, Math.floor(((espacio?.w ?? 600) - 300) / 6)))

    const repetir = () => { setEncontradas({}); setMemorizando(TUTORIAL.segundosParaMemorizar); setRonda(r => r + 1) }

    return (
        <div className="mem-panel">
            <h2 className="mem-subtitulo">¿Cómo funciona la correspondencia?</h2>
            <p className="mem-intro">
                No buscas dos imágenes iguales. Debes relacionar el <strong>nombre</strong> con
                su <strong>descripción</strong> correspondiente.
            </p>

            <div className="mem-tuto-cuerpo">
                <div className="mem-caja">
                    <h3>Ejemplo</h3>
                    <div className="mem-ejemplo" aria-label="Ejemplo de pareja">
                        <div className="mem-carta mem-arriba mem-practica" style={{ width: ancho }}>
                            <div className="mem-giro"><Reverso /><Cara carta={ejemplo[0]} /></div>
                        </div>
                        <span className="mem-match">⚡<br />PAREJA<br />⚡</span>
                        <div className="mem-carta mem-arriba mem-practica" style={{ width: ancho }}>
                            <div className="mem-giro"><Reverso /><Cara carta={ejemplo[1]} /></div>
                        </div>
                    </div>
                </div>

                <div className="mem-caja mem-caja-practica">
                    <h3>Práctica rápida</h3>
                    <Tablero
                        key={ronda}
                        cartas={cartas}
                        pares={TUTORIAL.pares}
                        encontradas={encontradas}
                        bloqueado={!liberado || memorizando > 0}
                        mostrarTodas={memorizando > 0}
                        mensaje={memorizando > 0 ? `Memoriza las cartas: ${memorizando} s` : null}
                        columnas={4}
                        anchoCarta={ancho}
                        practica
                        onToque={onToque}
                        onIntento={(acierto, par) => {
                            onToque()
                            if (acierto) setEncontradas(e => ({ ...e, [par]: true }))
                        }}
                        liberado={liberado}
                        pistaTras={3}
                    />
                </div>
            </div>

            <div className="mem-acciones">
                <button className="mem-boton" onClick={onTerminar} disabled={!liberado || !(lista || puedeSaltar)}>
                    ¡Entendido, a jugar!
                </button>
                {lista && <button className="mem-boton mem-boton-sutil" onClick={repetir}>Practicar otra vez</button>}
                <button className="mem-boton mem-boton-sutil" onClick={onVolver}>Ver reglas</button>
            </div>
            {!lista && !puedeSaltar && (
                <p className="mem-candado">Encuentra los {TUTORIAL.pares.length} pares de la práctica para continuar</p>
            )}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   El tablero — lo usan el juego y la práctica del tutorial
   ══════════════════════════════════════════════════════════════════════════

   Se encarga de destapar, comparar, volver a tapar y dar la pista. NO guarda
   qué parejas van encontradas: eso lo dice quien lo monta (`encontradas`) y se
   entera por `onIntento`. Así el juego lo manda al estado del aula y la
   práctica se lo queda en local, con el mismo tablero. */

function Tablero({
    cartas, pares, encontradas, bloqueado, mostrarTodas, mensaje,
    columnas, anchoCarta, rejillaRef, practica = false,
    onToque, onIntento, liberado, pistaTras = FALLOS_PARA_PISTA,
}) {
    const [volteadas, setVolteadas] = useState([])  // ids destapados ahorita (máx. 2)
    const [ocupado, setOcupado] = useState(false)   // esperando a que se tapen
    const [ultima, setUltima] = useState(null)      // la última jugada, para la tira de lectura
    const [pista, setPista] = useState(null)        // par que brilla para ayudar
    const fallosSeguidos = useRef(0)
    const relojes = useRef([])

    const despues = (ms, fn) => { relojes.current.push(setTimeout(fn, ms)) }
    useEffect(() => () => relojes.current.forEach(clearTimeout), [])

    const voltear = (carta) => {
        if (bloqueado || ocupado) return
        if (encontradas[carta.par] || volteadas.includes(carta.id)) {
            // Tocar una carta ya destapada no avanza, pero ES interactuar:
            // sin esto, alguien releyendo sus parejas se pinta de rojo.
            onToque()
            return
        }

        if (volteadas.length === 0) {
            setVolteadas([carta.id])
            setUltima(null)
            onToque()
            return
        }

        const primera = cartas.find(c => c.id === volteadas[0])
        setVolteadas([primera.id, carta.id])

        if (primera.par === carta.par) {
            fallosSeguidos.current = 0
            setPista(null)
            setUltima({ par: carta.par, acierto: true })
            onIntento(true, carta.par)
            despues(450, () => setVolteadas([]))
        } else {
            fallosSeguidos.current += 1
            setUltima({ ids: [primera.id, carta.id], acierto: false })
            onIntento(false, null)
            setOcupado(true)
            despues(1300, () => {
                setVolteadas([])
                setOcupado(false)
                if (fallosSeguidos.current >= pistaTras) {
                    fallosSeguidos.current = 0
                    const falta = pares.find(p => !encontradas[p.id] && p.id !== carta.par && p.id !== primera.par)
                        ?? pares.find(p => !encontradas[p.id])
                    if (falta) {
                        setPista(falta.id)
                        despues(2600, () => setPista(null))
                    }
                }
            })
        }
    }

    // La tira de lectura: en un pizarrón chico, el texto de la carta se lee
    // mal; aquí se repite en grande lo que acabas de destapar.
    const lectura = (() => {
        if (mensaje) return { tono: 'info', partes: [mensaje] }
        if (pista) return { tono: 'info', partes: ['💡 ¡Pista! Mira las dos cartas que brillan'] }
        if (ultima?.acierto) {
            const p = pares.find(x => x.id === ultima.par)
            return { tono: 'bien', partes: [lado(p.a).texto, lado(p.b).texto] }
        }
        const ids = volteadas.length ? volteadas : ultima?.ids ?? []
        if (ids.length) return { tono: 'neutro', partes: ids.map(id => cartas.find(c => c.id === id)?.texto ?? '') }
        return null
    })()

    return (
        <>
            <div ref={rejillaRef} className="mem-tablero" style={{ gridTemplateColumns: `repeat(${columnas}, ${anchoCarta}px)` }}>
                {cartas.map(carta => {
                    const hecha = !!encontradas[carta.par]
                    const arriba = hecha || volteadas.includes(carta.id) || mostrarTodas
                    const brillo = BRILLOS[Math.max(0, pares.findIndex(p => p.id === carta.par)) % BRILLOS.length]
                    const clases = ['mem-carta',
                        arriba && 'mem-arriba',
                        hecha && 'mem-hecha',
                        ocupado && volteadas.includes(carta.id) && 'mem-fallo',
                        pista === carta.par && !arriba && 'mem-pista',
                        practica && 'mem-practica',
                    ].filter(Boolean).join(' ')
                    return (
                        <button
                            key={carta.id}
                            className={clases}
                            style={{ '--brillo': brillo }}
                            onClick={() => voltear(carta)}
                            disabled={!liberado}
                            aria-label={arriba ? carta.texto : 'Carta tapada'}
                        >
                            <div className="mem-giro">
                                <Reverso />
                                <Cara carta={carta} />
                            </div>
                        </button>
                    )
                })}
            </div>

            <div className={`mem-lectura mem-lectura-${lectura?.tono ?? 'vacia'}`}>
                {lectura
                    ? lectura.partes.map((t, i) => <span key={i}>{t}</span>)
                    : <span className="mem-lectura-pista">Destapa dos cartas</span>}
            </div>
        </>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Acomodo — que el tablero quepa completo en el pizarrón
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Mide el hueco que nos dio el aula (ancho Y alto). Si solo se mirara el
 * ancho, las cartas en un pizarrón ancho y bajo salen gigantes y hay que bajar
 * para ver la mitad.
 *
 * `extra` es lo que ocupa todo lo que NO es el tablero (cabeza, tira de
 * lectura, aviso final): se mide en vivo porque cambia — en un pizarrón
 * angosto la cabeza se parte en dos renglones. No depende del tamaño de las
 * cartas, así que medirlo no provoca un ciclo de redimensionar.
 */
function useEspacio(raiz, rejilla) {
    const [espacio, setEspacio] = useState(null)
    useEffect(() => {
        const padre = raiz.current?.parentElement
        if (!padre) return
        const medir = () => {
            const extra = rejilla.current
                ? raiz.current.offsetHeight - rejilla.current.offsetHeight
                : 140
            const nuevo = { w: padre.clientWidth, h: padre.clientHeight, extra }
            setEspacio(v => (v && v.w === nuevo.w && v.h === nuevo.h && v.extra === nuevo.extra ? v : nuevo))
        }
        medir()
        const ro = new ResizeObserver(medir)
        ro.observe(padre)
        ro.observe(raiz.current)
        return () => ro.disconnect()
    }, [raiz, rejilla])
    return espacio
}

/**
 * Cuántas columnas y qué tan ancha cada carta. Prueba todas las columnas
 * posibles y se queda con la que deja las cartas más grandes.
 */
const HUECO = 10            // separación entre cartas
const RESERVADO_ANCHO = 40  // márgenes a los lados + la sombra corrida de la carta
const CARTA_MIN = 52        // menos que esto ya no se distingue nada: mejor que haya scroll
const CARTA_MAX = 160       // más que esto en un pizarrón grande se ve tosco

function acomodo(n, espacio) {
    if (!n) return { columnas: 1, anchoCarta: 100 }
    const w = Math.max(200, (espacio?.w ?? 720) - RESERVADO_ANCHO)
    const h = Math.max(200, (espacio?.h ?? 520) - (espacio?.extra ?? 140) - 8)
    let mejor = { columnas: Math.min(n, 5), anchoCarta: CARTA_MIN }
    for (let columnas = 1; columnas <= n; columnas++) {
        const filas = Math.ceil(n / columnas)
        const porAncho = (w - HUECO * (columnas - 1)) / columnas
        const porAlto = ((h - HUECO * (filas - 1)) / filas) * (5 / 7)
        const ancho = Math.min(porAncho, porAlto, CARTA_MAX)
        if (ancho > mejor.anchoCarta) mejor = { columnas, anchoCarta: ancho }
    }
    return { columnas: mejor.columnas, anchoCarta: Math.floor(mejor.anchoCarta) }
}

/* ══════════════════════════════════════════════════════════════════════════
   Las cartas
   ══════════════════════════════════════════════════════════════════════════ */

function Reverso() {
    return (
        <div className="mem-cara mem-reverso">
            <img className="mem-orn mem-orn-1" src={ornamento} alt="" draggable={false} />
            <img className="mem-orn mem-orn-2" src={ornamento} alt="" draggable={false} />
            <Gema className="mem-gema-centro" claro />
        </div>
    )
}

/** Con imagen, el texto corto es un nombre y el largo, una explicación. */
const LARGO_DE_NOMBRE = 22

function Cara({ carta }) {
    if (carta.imagen && carta.texto.length <= LARGO_DE_NOMBRE) {
        return (
            <div className="mem-cara mem-frente mem-ilustrada">
                <Gema className="mem-gema-esquina" />
                <img className="mem-dibujo" src={carta.imagen} alt="" loading="lazy" draggable={false} />
                <span className="mem-nombre" style={{ fontSize: tamNombre(carta.texto) }}>{carta.texto}</span>
            </div>
        )
    }
    if (carta.imagen) {
        return (
            <div className="mem-cara mem-frente mem-explicada">
                <span className="mem-texto" style={{ fontSize: tamTexto(carta.texto) }}>{carta.texto}</span>
                <img className="mem-dibujo mem-dibujo-chico" src={carta.imagen} alt="" loading="lazy" draggable={false} />
                <Gema className="mem-gema-pie" />
            </div>
        )
    }
    return (
        <div className="mem-cara mem-frente mem-solo-texto">
            <span className="mem-texto" style={{ fontSize: tamTexto(carta.texto) }}>{carta.texto}</span>
            <Gema className="mem-gema-pie" />
        </div>
    )
}

// El tamaño de letra depende de cuánto texto trae la carta, en unidades de la
// propia carta (cqw): crece y se encoge con ella, a cualquier tamaño de pantalla.
const tamNombre = (t) => (t.length <= 8 ? '12cqw' : t.length <= 13 ? '9.5cqw' : '8cqw')
const tamTexto = (t) => (t.length <= 45 ? '10.5cqw' : t.length <= 80 ? '9.4cqw' : t.length <= 120 ? '8.2cqw' : '7cqw')

/** La gema de Destello, en vector: nítida a cualquier tamaño y casi sin peso. */
function Gema({ className, claro = false }) {
    const c = claro
        ? { arriba: '#8b85e8', izq: '#5058dc', der: '#b68ae0', abIzq: '#6c4ad8', abDer: '#6545d6', chispa: '#ffffff' }
        : { arriba: '#5b2bd9', izq: '#3d12c4', der: '#b20fd8', abIzq: '#4a1fe0', abDer: '#3f1ad0', chispa: '#ff8a5c' }
    return (
        <svg className={className} viewBox="0 0 380 385" aria-hidden>
            <polygon points="157,0 290,118 157,158 25,118" fill={c.arriba} />
            <polygon points="25,118 157,158 157,251 0,251" fill={c.izq} />
            <polygon points="157,158 290,118 317,251 157,251" fill={c.der} />
            <polygon points="0,251 157,251 157,383" fill={c.abIzq} />
            <polygon points="157,251 317,251 157,383" fill={c.abDer} />
            <path d="M352 30 L356 46 L372 50 L356 54 L352 70 L348 54 L332 50 L348 46 Z" fill={c.chispa} opacity=".85" />
        </svg>
    )
}

/* ── Estilos ────────────────────────────────────────────────────────────────
   En una hoja aparte de los estilos en línea porque el giro 3D, el brillo y
   las consultas de contenedor no se pueden escribir en `style={{}}`. Todo
   lleva prefijo `mem-` para no chocar con nada del aula. */
const CSS = `
.mem {
    width: 100%; max-width: 900px; padding: var(--space-4, 16px);
    display: flex; flex-direction: column; gap: 12px;
    font-family: var(--font-sans);
}
.mem-cabeza { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 28px; }
.mem-titulo { font-weight: 600; font-size: var(--text-sm, 14px); color: var(--text-primary); }
.mem-cuenta { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-xs, 12px); color: var(--text-muted); }
.mem-boton {
    font: 600 var(--text-sm, 14px)/1 'Saira Semi Condensed', var(--font-sans);
    letter-spacing: .06em; text-transform: uppercase;
    padding: 10px 18px; border-radius: 999px; border: 0; cursor: pointer; color: #fff;
    background: linear-gradient(45deg, #1f48ff, #8a45f5 55%, #ff3cf0);
    box-shadow: 0 4px 18px -4px rgba(170, 70, 245, .7);
}
.mem-boton:disabled { cursor: not-allowed; filter: grayscale(.7); opacity: .6; }
.mem-boton-sutil {
    padding: 5px 12px; font-size: 11px; background: transparent; color: var(--text-muted);
    border: 1px solid var(--border-default); box-shadow: none;
}
.mem-acciones { display: flex; align-items: center; justify-content: center; gap: 10px; flex-wrap: wrap; }

/* ── Instrucciones y tutorial ───────────────────────────────────────────── */
.mem-panel {
    width: 100%; max-width: 680px; margin: 0 auto;
    display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
    padding: 14px clamp(12px, 2.4vw, 22px); border-radius: 16px;
    background:
        radial-gradient(circle at 15% 0%, rgba(255, 60, 240, .16), transparent 55%),
        radial-gradient(circle at 90% 100%, rgba(31, 72, 255, .18), transparent 55%),
        var(--bg-surface);
    border: 1px solid rgba(166, 63, 240, .45);
}
.mem-insignia {
    font: 700 11px/1 'Saira Semi Condensed', var(--font-sans); letter-spacing: .12em; text-transform: uppercase;
    padding: 5px 10px; border-radius: 999px; color: #f0d9ff;
    background: linear-gradient(45deg, rgba(31, 72, 255, .5), rgba(255, 60, 240, .5));
}
.mem-gran-titulo, .mem-subtitulo {
    margin: 0; font-family: 'Saira Semi Condensed', var(--font-sans); font-weight: 700;
    letter-spacing: .06em; line-height: 1.1;
    background: linear-gradient(45deg, #4f6bff, #a63ff0 50%, #ff3cf0);
    -webkit-background-clip: text; background-clip: text; color: transparent;
}
.mem-gran-titulo { font-size: clamp(22px, 3.6vw, 30px); text-transform: uppercase; }
.mem-subtitulo { font-size: clamp(17px, 2.6vw, 22px); }
.mem-intro { margin: 0; max-width: 58ch; font-size: 13px; line-height: 1.45; color: var(--text-secondary, var(--text-muted)); }
.mem-reglas {
    width: 100%; max-width: 540px; text-align: left; padding: 10px 14px; border-radius: 12px;
    background: rgba(166, 63, 240, .08); border: 1px solid rgba(166, 63, 240, .3);
}
.mem-reglas h3 {
    margin: 0 0 6px; font: 700 12px/1.2 'Saira Semi Condensed', var(--font-sans);
    letter-spacing: .1em; text-transform: uppercase; color: #c084fc;
}
.mem-reglas ul { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 4px; }
.mem-reglas li { font-size: 12.5px; line-height: 1.4; color: var(--text-primary); }
.mem-reglas li::marker { color: #ff3cf0; }

.mem-tuto-cuerpo { width: 100%; display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; align-items: stretch; }
.mem-caja {
    display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 12px; border: 1px dashed rgba(166, 63, 240, .45);
}
.mem-caja-practica { flex: 1 1 auto; }
.mem-ejemplo { display: flex; align-items: center; justify-content: center; gap: 10px; flex: 1; }
.mem-ejemplo .mem-carta { cursor: default; }
.mem-match {
    font: 700 12px/1.5 'Saira Semi Condensed', var(--font-sans); letter-spacing: .12em; color: #fbbf24;
    text-align: center; text-shadow: 0 0 10px rgba(251, 191, 36, .7);
}
.mem-caja h3 {
    margin: 0; font: 700 11px/1.2 'Saira Semi Condensed', var(--font-sans);
    letter-spacing: .1em; text-transform: uppercase; color: #c084fc;
}
.mem-caja-practica .mem-lectura { width: 100%; height: 42px; padding: 4px 10px; font-size: 12.5px; }
.mem-candado { margin: 0; font-size: var(--text-xs, 12px); color: var(--text-muted); }

/* ── Tablero ────────────────────────────────────────────────────────────── */
.mem-tablero { display: grid; gap: 10px; justify-content: center; }

/* La carta: un botón con proporción de naipe y su propio contenedor, para que
   todo adentro (letra, bordes, sombra) se mida contra el ancho de la carta. */
.mem-carta {
    position: relative; aspect-ratio: 5 / 7; width: 100%;
    padding: 0; border: 0; background: none; cursor: pointer;
    container-type: inline-size; perspective: 900px;
    -webkit-tap-highlight-color: transparent;
}
.mem-carta:disabled { cursor: not-allowed; }
.mem-giro {
    position: absolute; inset: 0; transform-style: preserve-3d;
    transition: transform .5s cubic-bezier(.3, 1.4, .5, 1);
}
.mem-arriba .mem-giro { transform: rotateY(180deg); }
.mem-carta:not(.mem-arriba):not(:disabled):hover .mem-giro { transform: translateY(-3%) rotate(-1.5deg); }
.mem-fallo .mem-giro { animation: mem-temblor .4s .5s; }
@keyframes mem-temblor {
    0%, 100% { transform: rotateY(180deg) translateX(0); }
    25% { transform: rotateY(180deg) translateX(4%); }
    75% { transform: rotateY(180deg) translateX(-4%); }
}

/* Pista: la pareja brilla y da un saltito, todavía tapada */
.mem-pista .mem-reverso { box-shadow: 0 0 0 1.4cqw #fbbf24, 0 0 9cqw 1cqw rgba(251, 191, 36, .85); }
.mem-pista .mem-giro { animation: mem-saltito .9s ease-in-out infinite; }
@keyframes mem-saltito {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-5%); }
}

.mem-cara {
    position: absolute; inset: 0; border-radius: 8cqw; overflow: hidden;
    backface-visibility: hidden; -webkit-backface-visibility: hidden;
}

/* Reverso: lila con adornos en esquinas opuestas y la gema al centro */
.mem-reverso {
    background: linear-gradient(160deg, #fbf1fe 0%, #f2e3fc 50%, #ead3fb 100%);
    border: 1.1cqw solid #8b52f7;
    box-shadow: 0 2cqw 5cqw -1cqw rgba(60, 20, 140, .45);
}
.mem-orn { position: absolute; width: 56cqw; pointer-events: none; user-select: none; }
.mem-orn-1 { top: 3.5cqw; right: 4cqw; }
.mem-orn-2 { bottom: 3.5cqw; left: 4cqw; transform: rotate(180deg); }
.mem-gema-centro { position: absolute; width: 26cqw; left: 37cqw; top: calc(50% - 13cqw); }

/* Frente: el degradado azul → violeta → magenta con la sombra azul corrida */
.mem-frente {
    transform: rotateY(180deg);
    background: linear-gradient(to top right, #1f48ff 0%, #6a45f6 38%, #a63ff0 68%, #ff3cf0 100%);
    /* La sombra azul sólida del diseño original, corrida abajo a la derecha.
       La X va en negativo porque esta cara está girada 180°: su izquierda es
       la derecha de quien la ve. */
    --sombra: -2.4cqw 2.4cqw 0 #0a46ff;
    box-shadow: var(--sombra), inset 0 0 0 .4cqw rgba(255, 255, 255, .12);
    overflow: visible;
}
/* Las cartas del tutorial, en coral → violeta como las de práctica originales */
.mem-practica .mem-frente { background: linear-gradient(to right, #f75b6a 0%, #c958b6 55%, #9a57f2 100%); }

.mem-nombre, .mem-texto {
    font-family: 'Saira Semi Condensed', var(--font-sans); font-weight: 700;
    color: #e6e9ff; text-align: center; line-height: 1.32;
    text-shadow: 0 0 1.6cqw rgba(176, 190, 255, .95), 0 0 4.5cqw rgba(140, 160, 255, .55);
    overflow-wrap: anywhere; hyphens: auto;
}
.mem-ilustrada { display: flex; flex-direction: column; align-items: center; padding: 9cqw 6cqw 10cqw; }
.mem-dibujo { flex: 1 1 0; min-height: 0; width: 100%; object-fit: contain; filter: drop-shadow(0 2cqw 3cqw rgba(30, 10, 90, .35)); }
.mem-nombre { margin-top: 5cqw; text-transform: uppercase; letter-spacing: .1em; }
.mem-gema-esquina { position: absolute; top: 6cqw; right: 6cqw; width: 11cqw; }

.mem-explicada { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8cqw; padding: 12cqw 8cqw 18cqw; }
.mem-dibujo-chico { flex: 0 1 auto; width: auto; max-width: 50%; max-height: 30%; }

.mem-solo-texto { display: flex; align-items: center; justify-content: center; padding: 10cqw 8cqw 16cqw; }
.mem-texto { letter-spacing: .09em; }
.mem-gema-pie { position: absolute; bottom: 6cqw; left: 7cqw; width: 11cqw; }

/* Pareja encontrada: aro de color propio y un ligero respiro */
.mem-hecha .mem-frente { box-shadow: var(--sombra), inset 0 0 0 1.4cqw var(--brillo), 0 0 7cqw 0 var(--brillo); }
.mem-hecha .mem-giro { animation: mem-pareja .55s ease-out; }
@keyframes mem-pareja {
    0% { transform: rotateY(180deg) scale(1); }
    40% { transform: rotateY(180deg) scale(1.07); }
    100% { transform: rotateY(180deg) scale(1); }
}

.mem-lectura {
    /* Alto FIJO (no mínimo): si creciera con cada texto, el tablero se
       reacomodaría cada vez que alguien destapa una descripción larga. */
    height: 76px; overflow-y: auto; display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
    gap: 6px 14px; padding: 8px 14px; border-radius: var(--radius-md, 10px); text-align: center;
    font-size: var(--text-sm, 14px); color: var(--text-primary);
    background: var(--bg-surface); border: 1px solid var(--border-subtle);
    transition: background .2s, border-color .2s;
}
.mem-lectura span + span::before { content: '↔'; margin-right: 14px; color: var(--text-muted); }
.mem-lectura-bien { border-color: #34d399; background: rgba(52, 211, 153, .10); }
.mem-lectura-info { border-color: #a63ff0; background: rgba(166, 63, 240, .10); }
.mem-lectura-pista { color: var(--text-muted); }

.mem-fin {
    display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;
    padding: 12px 14px; border-radius: var(--radius-md, 10px);
    background: linear-gradient(45deg, rgba(31, 72, 255, .16), rgba(255, 60, 240, .16));
    border: 1px solid #a63ff0; font-weight: 600; color: var(--text-primary);
}

@media (prefers-reduced-motion: reduce) {
    .mem-giro { transition: none; }
    .mem-fallo .mem-giro, .mem-hecha .mem-giro, .mem-pista .mem-giro { animation: none; }
}
`
