/**
 * Destello — Actividad: Crucigrama
 *
 * Basada en el crucigrama de Día de Muertos de Paola (`mini-juegos/crucigrama`),
 * vuelta genérica: las palabras y sus pistas llegan en `contenido`. Cada vez
 * que alguien empieza, se arma un crucigrama nuevo con algunas de ellas.
 *
 * ── Forma del contenido ──────────────────────────────────────────────────
 *
 *   {
 *     titulo: 'Día de Muertos',
 *     instrucciones: '…',                 // opcional
 *     palabras: [{ palabra: 'CATRINA', pista: 'Elegante calavera mexicana…' }, …],
 *     cuantas: 5,                         // opcional: cuántas usar por crucigrama (default 5)
 *   }
 *
 * Conviene dar más palabras de las que se usan (el original tenía 14 para
 * armar crucigramas de 5): así cada partida sale distinta y el generador
 * tiene de dónde escoger para que se crucen bien.
 *
 * ── Estado ───────────────────────────────────────────────────────────────
 *
 *   { tablero: { filas, columnas, palabras: [{ id, palabra, pista, fila, col, dir: 'h'|'v', numero }] },
 *     letras: { 'f,c': 'A', … }, pasos: { CATRINA: true, … }, pistas: 2, tutorialHecho, ultimoCambio }
 *
 * Igual que en la sopa: el tablero vive en el estado, para que al volver a
 * entrar (o cuando lo ve la profe) sea el mismo. Sin tiempo límite.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { marcarCambio } from './contrato.js'
import { barajar, normalizarPalabra, useAltoDelPizarron, useTamano, COLORES_VIVOS } from './comun.js'

const TUTORIAL = {
    filas: 5, columnas: 4,
    palabras: [
        { id: 'CASA', palabra: 'CASA', pista: 'Lugar donde vives', fila: 0, col: 0, dir: 'h', numero: 1 },
        { id: 'ARBOL', palabra: 'ARBOL', pista: 'Planta grande con tronco y hojas', fila: 0, col: 1, dir: 'v', numero: 2 },
    ],
}

/* ══════════════════════════════════════════════════════════════════════════
   El generador
   ══════════════════════════════════════════════════════════════════════════ */

const MAX_LADO = 12

/**
 * Arma un crucigrama con hasta `cuantas` palabras que se crucen. Lo intenta
 * varias veces con distinto orden y se queda con el que metió más palabras
 * (y, empatados, el más compacto).
 */
export function generarCrucigrama(lista, cuantas = 5) {
    const pool = lista
        .map(p => ({ palabra: normalizarPalabra(p.palabra), pista: p.pista ?? '' }))
        .filter(p => p.palabra.length >= 2 && p.palabra.length <= MAX_LADO)
    if (!pool.length) return { filas: 0, columnas: 0, palabras: [] }

    let mejor = null
    for (let intento = 0; intento < 60; intento++) {
        const puestas = armar(barajar(pool), cuantas)
        const area = medidas(puestas)
        const puntos = puestas.length * 1000 - area.filas * area.columnas
        if (!mejor || puntos > mejor.puntos) mejor = { puestas, puntos }
        if (puestas.length >= Math.min(cuantas, pool.length) && intento > 15) break
    }
    return numerar(mejor.puestas)
}

function armar(orden, cuantas) {
    const celdas = new Map()  // 'f,c' → { letra, dirs: Set }
    const puestas = []
    const poner = (p, f, c, dir) => {
        const [df, dc] = dir === 'h' ? [0, 1] : [1, 0]
        for (let i = 0; i < p.palabra.length; i++) {
            const k = `${f + df * i},${c + dc * i}`
            const celda = celdas.get(k) ?? { letra: p.palabra[i], dirs: new Set() }
            celda.dirs.add(dir)
            celdas.set(k, celda)
        }
        puestas.push({ ...p, fila: f, col: c, dir })
    }

    poner(orden[0], 0, 0, 'h')
    for (const p of orden.slice(1)) {
        if (puestas.length >= cuantas) break
        const opciones = []
        for (const [k, celda] of celdas) {
            const [f0, c0] = k.split(',').map(Number)
            for (let i = 0; i < p.palabra.length; i++) {
                if (p.palabra[i] !== celda.letra) continue
                // Se cruza en sentido contrario a la que ya pasa por ahí.
                const dir = celda.dirs.has('h') ? 'v' : 'h'
                const f = dir === 'v' ? f0 - i : f0
                const c = dir === 'h' ? c0 - i : c0
                const cruces = cabe(celdas, p.palabra, f, c, dir)
                if (cruces > 0) opciones.push({ f, c, dir, cruces })
            }
        }
        const validas = opciones.filter(o => {
            const m = medidas([...puestas, { palabra: p.palabra, fila: o.f, col: o.c, dir: o.dir }])
            return m.filas <= MAX_LADO && m.columnas <= MAX_LADO
        })
        if (!validas.length) continue
        validas.sort((a, b) => b.cruces - a.cruces || Math.random() - 0.5)
        const o = validas[0]
        poner(p, o.f, o.c, o.dir)
    }
    return puestas
}

/** Cuántas letras comparte si se pone ahí, o -1 si no se puede poner. */
function cabe(celdas, palabra, f, c, dir) {
    const [df, dc] = dir === 'h' ? [0, 1] : [1, 0]
    const vacia = (ff, cc) => !celdas.has(`${ff},${cc}`)
    if (!vacia(f - df, c - dc) || !vacia(f + df * palabra.length, c + dc * palabra.length)) return -1
    let cruces = 0
    for (let i = 0; i < palabra.length; i++) {
        const ff = f + df * i
        const cc = c + dc * i
        const celda = celdas.get(`${ff},${cc}`)
        if (celda) {
            if (celda.letra !== palabra[i] || celda.dirs.has(dir)) return -1
            cruces++
        } else if (!vacia(ff + dc, cc + df) || !vacia(ff - dc, cc - df)) {
            // Una letra nueva no puede quedar pegada de lado a otra palabra.
            return -1
        }
    }
    return cruces
}

function medidas(puestas) {
    let fMin = Infinity, fMax = -Infinity, cMin = Infinity, cMax = -Infinity
    for (const p of puestas) {
        const largo = p.palabra.length - 1
        fMin = Math.min(fMin, p.fila); cMin = Math.min(cMin, p.col)
        fMax = Math.max(fMax, p.dir === 'v' ? p.fila + largo : p.fila)
        cMax = Math.max(cMax, p.dir === 'h' ? p.col + largo : p.col)
    }
    return { fMin, cMin, filas: fMax - fMin + 1, columnas: cMax - cMin + 1 }
}

/** Recorre todo a (0,0) y les pone número como en el periódico. */
function numerar(puestas) {
    const { fMin, cMin, filas, columnas } = medidas(puestas)
    const palabras = puestas.map(p => ({ id: p.palabra, palabra: p.palabra, pista: p.pista, fila: p.fila - fMin, col: p.col - cMin, dir: p.dir }))
    const inicios = [...new Set(palabras.map(p => `${p.fila},${p.col}`))]
        .map(k => k.split(',').map(Number))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const numero = new Map(inicios.map(([f, c], i) => [`${f},${c}`, i + 1]))
    for (const p of palabras) p.numero = numero.get(`${p.fila},${p.col}`)
    palabras.sort((a, b) => a.numero - b.numero || (a.dir === 'h' ? -1 : 1))
    return { filas, columnas, palabras }
}

const celdasDe = (p) => Array.from({ length: p.palabra.length }, (_, i) =>
    p.dir === 'h' ? `${p.fila},${p.col + i}` : `${p.fila + i},${p.col}`)

const resuelta = (p, letras) => celdasDe(p).every((k, i) => letras[k] === p.palabra[i])

/**
 * El tablero guardado, solo si de verdad es de un crucigrama. Si el estado trae
 * el de otra actividad (una sopa, por ejemplo), se ignora y se arranca de cero
 * en vez de tronar.
 */
const tableroDe = (estado) => {
    const t = estado?.tablero
    return Number.isInteger(t?.filas) && Number.isInteger(t?.columnas) && Array.isArray(t?.palabras)
        && t.palabras.every(p => p?.dir === 'h' || p?.dir === 'v') ? t : null
}

/** Resumen para la miniatura de la profe. */
export function resumen(contenido, estado) {
    const palabras = tableroDe(estado)?.palabras
    if (!palabras) return { avance: 0, etiqueta: 'sin empezar', terminado: false }
    const hechas = palabras.filter(p => estado?.pasos?.[p.id]).length
    return {
        avance:    palabras.length ? Math.round((hechas / palabras.length) * 100) : 0,
        etiqueta:  `${hechas} de ${palabras.length} palabras`,
        terminado: palabras.length > 0 && hechas >= palabras.length,
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   La actividad
   ══════════════════════════════════════════════════════════════════════════ */

export default function Crucigrama({ contenido, estado, onCambio, liberado, esProfe }) {
    const raiz = useRef(null)
    const alto = useAltoDelPizarron(raiz)
    const [fase, setFase] = useState('instrucciones')
    const [verReglas, setVerReglas] = useState(false)
    const [verRespuestas, setVerRespuestas] = useState(false)

    const lista = contenido?.palabras ?? []
    const cuantas = contenido?.cuantas ?? 5
    const tablero = tableroDe(estado)
    const empezado = !!tablero
    const toque = () => onCambio(marcarCambio(estado, {}))

    const empezar = (extra = {}) => {
        if (!liberado) return
        setVerReglas(false)
        onCambio(marcarCambio(estado, { tablero: generarCrucigrama(lista, cuantas), letras: {}, pasos: {}, pistas: 0, ...extra }))
    }

    if (!lista.length) {
        return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Este crucigrama todavía no tiene palabras.</p>
    }

    const total = tablero?.palabras.length ?? 0
    const hechas = tablero ? tablero.palabras.filter(p => estado?.pasos?.[p.id]).length : 0
    const terminado = empezado && total > 0 && hechas >= total
    const puedeSaltar = esProfe || estado?.tutorialHecho

    let pantalla
    if (empezado && !verReglas) {
        pantalla = (
            <div className="cruci-juego">
                <Tablero
                    key={tablero.palabras.map(p => p.id).join('|')}
                    tablero={tablero}
                    letras={estado?.letras ?? {}}
                    verRespuestas={verRespuestas}
                    bloqueado={!liberado || terminado}
                    onLetras={(letras, extra = {}) => {
                        const pasos = Object.fromEntries(tablero.palabras.filter(p => resuelta(p, letras)).map(p => [p.id, true]))
                        onCambio(marcarCambio(estado, { letras, pasos, ...extra }))
                    }}
                    pistas={estado?.pistas ?? 0}
                />
                {terminado && (
                    <div className="cruci-fin">
                        <span className="cruci-fin-texto">
                            🎉 ¡Completaste el crucigrama!
                            {(estado?.pistas ?? 0) > 0 && ` (con ${estado.pistas} ${estado.pistas === 1 ? 'letra revelada' : 'letras reveladas'})`}
                        </span>
                        <button className="cruci-boton" onClick={() => empezar()} disabled={!liberado}>Otro crucigrama</button>
                    </div>
                )}
            </div>
        )
    } else if (!empezado && fase === 'tutorial') {
        pantalla = (
            <Tutorial
                liberado={liberado}
                puedeSaltar={puedeSaltar}
                onToque={toque}
                onTerminar={() => empezar({ tutorialHecho: true })}
                onVolver={() => setFase('instrucciones')}
            />
        )
    } else {
        pantalla = (
            <div className="cruci-panel cruci-scroll">
                <span className="cruci-insignia">✦ Crucigrama</span>
                <h2 className="cruci-gran-titulo">{contenido?.titulo ?? 'Crucigrama'}</h2>
                <p className="cruci-intro">
                    {contenido?.instrucciones ?? 'Lee cada pista y escribe la palabra que le corresponde.'}
                </p>
                <div className="cruci-reglas">
                    <div><span className="cruci-chip">1</span> Toca una casilla o una pista para elegir la palabra.</div>
                    <div><span className="cruci-chip">2</span> Escribe: el cursor avanza solo. Toca otra vez la casilla de un cruce para cambiar de dirección.</div>
                    <div><span className="cruci-chip">3</span> Cuando una palabra queda bien, se pinta de color. Sin tiempo límite.</div>
                    <div><span className="cruci-chip">💡</span> ¿Atorada? "Revelar letra" te da una letra de la palabra elegida.</div>
                </div>
                <div className="cruci-acciones">
                    {verReglas ? (
                        <button className="cruci-boton" onClick={() => setVerReglas(false)}>Volver al juego</button>
                    ) : (
                        <>
                            <button className="cruci-boton" onClick={() => { setFase('tutorial'); toque() }} disabled={!liberado}>¿Cómo jugar?</button>
                            {puedeSaltar && <button className="cruci-boton cruci-boton-sutil" onClick={() => empezar()} disabled={!liberado}>Ya sé jugar</button>}
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div ref={raiz} className="cruci" style={{ height: alto ?? undefined, opacity: liberado ? 1 : 0.55 }}>
            <style>{CSS}</style>
            <div className="cruci-cabeza">
                {contenido?.titulo && <span className="cruci-titulo">{contenido.titulo}</span>}
                {empezado && !verReglas && <span className="cruci-cuenta">{hechas}/{total} palabras</span>}
                {empezado && !verReglas && <button className="cruci-boton cruci-boton-sutil" onClick={() => setVerReglas(true)}>Reglas</button>}
                {esProfe && empezado && !verReglas && (
                    <button className="cruci-boton cruci-boton-sutil" onClick={() => setVerRespuestas(v => !v)}>
                        {verRespuestas ? 'Ocultar' : 'Ver respuestas'}
                    </button>
                )}
            </div>
            {pantalla}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Tutorial: CASA y ÁRBOL
   ══════════════════════════════════════════════════════════════════════════ */

function Tutorial({ liberado, puedeSaltar, onToque, onTerminar, onVolver }) {
    const [letras, setLetras] = useState({})
    const lista = TUTORIAL.palabras.every(p => resuelta(p, letras))
    return (
        <div className="cruci-panel cruci-scroll">
            <h2 className="cruci-subtitulo">¿Cómo se juega?</h2>
            <p className="cruci-intro">
                Resuelve este mini crucigrama: <strong>1 →</strong> lugar donde vives y <strong>2 ↓</strong> planta
                grande con tronco. Fíjate cómo comparten la letra <strong>A</strong>.
            </p>
            <div className="cruci-tuto">
                <Tablero
                    tablero={TUTORIAL}
                    letras={letras}
                    bloqueado={!liberado}
                    compacto
                    onLetras={(l) => { setLetras(l); onToque() }}
                    pistas={0}
                />
            </div>
            <div className="cruci-acciones">
                <button className="cruci-boton" onClick={onTerminar} disabled={!liberado || !(lista || puedeSaltar)}>¡Entendido, a jugar!</button>
                <button className="cruci-boton cruci-boton-sutil" onClick={onVolver}>Ver reglas</button>
            </div>
            {!lista && !puedeSaltar && <p className="cruci-candado">Completa CASA y ÁRBOL para continuar</p>}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   El tablero — lo usan el juego y el tutorial
   ══════════════════════════════════════════════════════════════════════════ */

function Tablero({ tablero, letras, verRespuestas = false, bloqueado, compacto = false, onLetras, pistas }) {
    const { filas, columnas, palabras } = tablero
    const hueco = useRef(null)
    const { w, h } = useTamano(hueco)
    const casilla = compacto ? 40 : Math.max(26, Math.min(50, Math.floor(Math.min(((w || 400) - 12) / columnas, ((h || 400) - 12) / filas)) - 3))
    const entradas = useRef({})

    // Qué palabras pasan por cada casilla, y la letra que va ahí.
    const mapa = useMemo(() => {
        const m = {}
        for (const p of palabras) {
            celdasDe(p).forEach((k, i) => {
                m[k] ??= { letra: p.palabra[i], palabras: {} }
                m[k].palabras[p.dir] = p
                if (i === 0) m[k].numero = p.numero
            })
        }
        return m
    }, [palabras])

    const [activa, setActiva] = useState(() => ({ celda: celdasDe(palabras[0])[0], dir: palabras[0].dir }))
    const palabraActiva = mapa[activa.celda]?.palabras[activa.dir] ?? Object.values(mapa[activa.celda]?.palabras ?? {})[0] ?? palabras[0]
    const celdasActivas = new Set(celdasDe(palabraActiva))

    const colorDe = useMemo(() => {
        const m = {}
        palabras.forEach((p, i) => { if (resuelta(p, letras)) celdasDe(p).forEach(k => { m[k] ??= COLORES_VIVOS[i % COLORES_VIVOS.length] }) })
        return m
    }, [palabras, letras])

    // Al mover el cursor desde código (flechas, avance al escribir) el foco
    // no debe volver a decidir la dirección: eso solo cuando la persona toca.
    const desdeCodigo = useRef(false)
    const enfocar = (k) => { desdeCodigo.current = true; entradas.current[k]?.focus(); desdeCodigo.current = false }
    useEffect(() => { if (!compacto) enfocar(activa.celda) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

    const elegir = (k, dir) => setActiva({ celda: k, dir })
    const alTocar = (k) => {
        const dirs = Object.keys(mapa[k].palabras)
        if (k === activa.celda && dirs.length > 1) elegir(k, activa.dir === 'h' ? 'v' : 'h')
        else elegir(k, dirs.includes(activa.dir) ? activa.dir : dirs[0])
    }
    const bloqueadaLaCelda = (k) => !!colorDe[k]
    /** La siguiente casilla de la palabra activa en esa dirección, brincando las ya resueltas. */
    const siguiente = (k, paso, brincar = true) => {
        const lista = celdasDe(palabraActiva)
        for (let i = lista.indexOf(k) + paso; i >= 0 && i < lista.length; i += paso) {
            if (!brincar || !bloqueadaLaCelda(lista[i])) return lista[i]
        }
        return null
    }
    const mover = (k, paso) => {
        const sig = siguiente(k, paso, false)
        if (sig) { elegir(sig, palabraActiva.dir); enfocar(sig) }
    }

    const escribir = (k, valor) => {
        if (bloqueado) return
        const letra = normalizarPalabra(valor).slice(-1)
        if (bloqueadaLaCelda(k)) {
            // Una letra ya resuelta (un cruce). Si escribió esa misma letra —lo
            // natural al teclear la palabra completa— solo avanza; si escribió
            // otra, va a la siguiente casilla libre.
            if (!letra) return
            if (letra === mapa[k].letra) { mover(k, 1); return }
            const libre = siguiente(k, 1)
            if (!libre) return
            onLetras({ ...letras, [libre]: letra })
            mover(libre, 1)
            return
        }
        onLetras({ ...letras, [k]: letra })
        if (letra) mover(k, 1)
    }
    const alTecla = (k, e) => {
        if (e.key === 'Backspace' && !letras[k]) { e.preventDefault(); mover(k, -1); return }
        const flechas = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] }
        if (flechas[e.key]) {
            e.preventDefault()
            const [df, dc] = flechas[e.key]
            const [f, c] = k.split(',').map(Number)
            const sig = `${f + df},${c + dc}`
            if (mapa[sig]) {
                const dir = df ? 'v' : 'h'
                elegir(sig, mapa[sig].palabras[dir] ? dir : Object.keys(mapa[sig].palabras)[0])
                enfocar(sig)
            }
        }
    }

    const revelar = () => {
        if (bloqueado) return
        const k = celdasDe(palabraActiva).find((kk, i) => letras[kk] !== palabraActiva.palabra[i])
        if (!k) return
        onLetras({ ...letras, [k]: mapa[k].letra }, { pistas: pistas + 1 })
    }

    const pistaDe = (p) => `${p.pista} (${p.palabra.length} letras)`

    return (
        <div className={`cruci-tablero ${compacto ? 'cruci-tablero-compacto' : ''}`}>
            <div className="cruci-izq">
                <div className="cruci-activa">
                    <span className="cruci-activa-num">{palabraActiva.numero} {palabraActiva.dir === 'h' ? '→' : '↓'}</span>
                    <span>{pistaDe(palabraActiva)}</span>
                    {!compacto && (
                        <button className="cruci-boton cruci-boton-sutil" onClick={revelar} disabled={bloqueado || resuelta(palabraActiva, letras)}>💡 Revelar letra</button>
                    )}
                </div>
                <div ref={hueco} className="cruci-hueco">
                    <div className="cruci-rejilla" style={{ gridTemplateColumns: `repeat(${columnas}, ${casilla}px)`, gridAutoRows: `${casilla}px` }}>
                        {Array.from({ length: filas * columnas }, (_, i) => {
                            const k = `${Math.floor(i / columnas)},${i % columnas}`
                            const celda = mapa[k]
                            if (!celda) return <span key={k} className="cruci-vacia" />
                            const color = colorDe[k]
                            return (
                                <label
                                    key={k}
                                    className={`cruci-celda ${celdasActivas.has(k) ? 'cruci-en-palabra' : ''} ${k === activa.celda ? 'cruci-cursor' : ''} ${color ? 'cruci-hecha' : ''}`}
                                    style={color ? { '--color': color } : undefined}
                                >
                                    {celda.numero && <span className="cruci-num">{celda.numero}</span>}
                                    <input
                                        ref={el => { entradas.current[k] = el }}
                                        value={letras[k] ?? ''}
                                        placeholder={verRespuestas ? celda.letra : ''}
                                        onChange={e => escribir(k, e.target.value)}
                                        onKeyDown={e => alTecla(k, e)}
                                        onFocus={() => { if (!desdeCodigo.current && k !== activa.celda) alTocar(k) }}
                                        onClick={() => k === activa.celda && alTocar(k)}
                                        readOnly={bloqueado}
                                        maxLength={2}
                                        autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
                                        aria-label={`Casilla ${k}`}
                                        style={{ fontSize: Math.round(casilla * 0.52) }}
                                    />
                                </label>
                            )
                        })}
                    </div>
                </div>
            </div>
            {!compacto && (
                <div className="cruci-pistas">
                    {[['h', 'Horizontales →'], ['v', 'Verticales ↓']].map(([dir, nombre]) => {
                        const deEsta = palabras.filter(p => p.dir === dir)
                        if (!deEsta.length) return null
                        return (
                            <div key={dir}>
                                <h4>{nombre}</h4>
                                <ol>
                                    {deEsta.map(p => (
                                        <li key={p.id}>
                                            <button
                                                className={`${p === palabraActiva ? 'cruci-pista-activa' : ''} ${resuelta(p, letras) ? 'cruci-pista-hecha' : ''}`}
                                                onClick={() => { const k = celdasDe(p)[0]; elegir(k, p.dir); enfocar(k) }}
                                            >
                                                <strong>{p.numero}.</strong> {pistaDe(p)}
                                            </button>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

/* ── Estilos ────────────────────────────────────────────────────────────────
   Del original: noche morada, cursor ámbar, palabra activa en rosa y un color
   vivo por palabra resuelta. Siempre oscuro. Prefijo `cruci-`. */
const CSS = `
.cruci {
    width: 100%; display: flex; flex-direction: column; gap: 10px; padding: 12px; box-sizing: border-box;
    font-family: 'Outfit', var(--font-sans); color: #f3f4f6; border-radius: 16px; overflow: hidden;
    background: linear-gradient(135deg, #020617 0%, #3b0764 55%, #0f172a 100%);
}
.cruci-cabeza { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 28px; }
.cruci-titulo { font: 600 16px/1.1 'Fredoka', 'Outfit', sans-serif; color: #fcd34d; }
.cruci-cuenta { margin-left: auto; font-weight: 700; font-size: 13px; color: #f9a8d4; }
.cruci-boton {
    font: 700 14px/1 'Outfit', var(--font-sans); padding: 11px 20px; border-radius: 14px; border: 0; cursor: pointer; color: #fff;
    background: linear-gradient(90deg, #ec4899, #f97316); box-shadow: 0 6px 20px -6px rgba(236, 72, 153, .7);
}
.cruci-boton:disabled { cursor: not-allowed; filter: grayscale(.7); opacity: .55; }
.cruci-boton-sutil { padding: 6px 12px; font-size: 12px; font-weight: 600; background: rgba(168, 85, 247, .15); border: 1px solid rgba(168, 85, 247, .4); box-shadow: none; }
.cruci-acciones { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.cruci-juego { flex: 1; min-height: 0; overflow-y: auto; position: relative; }
.cruci-scroll { flex: 0 1 auto; min-height: 0; overflow-y: auto; margin-block: auto; }
.cruci-juego { display: flex; flex-direction: column; gap: 10px; }

.cruci-panel {
    width: 100%; max-width: 640px; margin: 0 auto; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
    padding: 18px clamp(12px, 3vw, 28px); border-radius: 18px;
    background: rgba(15, 23, 42, .9); border: 1px solid rgba(168, 85, 247, .3);
}
.cruci-insignia { font-weight: 700; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; padding: 5px 14px; border-radius: 999px; background: rgba(88, 28, 135, .5); border: 1px solid rgba(168, 85, 247, .3); color: #e9d5ff; }
.cruci-gran-titulo, .cruci-subtitulo {
    margin: 0; font-family: 'Fredoka', 'Outfit', sans-serif; font-weight: 700; line-height: 1.1;
    background: linear-gradient(90deg, #f472b6, #fb923c, #fde047); -webkit-background-clip: text; background-clip: text; color: transparent;
}
.cruci-gran-titulo { font-size: clamp(24px, 4vw, 34px); animation: cruci-brillo 2.4s ease-in-out infinite; }
@keyframes cruci-brillo { 50% { filter: drop-shadow(0 0 14px rgba(245, 158, 11, .7)); } }
.cruci-subtitulo { font-size: 22px; }
.cruci-intro { margin: 0; max-width: 56ch; font-size: 14px; line-height: 1.45; color: #cbd5e1; }
.cruci-reglas { width: 100%; max-width: 520px; display: flex; flex-direction: column; gap: 6px; text-align: left; font-size: 13px; line-height: 1.4; }
.cruci-reglas > div { display: flex; gap: 10px; align-items: flex-start; padding: 8px 10px; border-radius: 12px; background: rgba(88, 28, 135, .25); }
.cruci-chip { flex: 0 0 auto; min-width: 22px; text-align: center; background: #6b21a8; color: #fcd34d; border-radius: 8px; padding: 3px 5px; font-weight: 700; font-size: 12px; }
.cruci-candado { margin: 0; font-size: 12px; color: #94a3b8; }
.cruci-tuto { display: flex; justify-content: center; }

/* ── Tablero ── */
.cruci-tablero { flex: 1; min-height: 0; display: flex; gap: 14px; flex-wrap: wrap; align-items: stretch; }
.cruci-tablero-compacto { flex: 0 0 auto; flex-direction: column; align-items: center; }
.cruci-izq { flex: 2 1 320px; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
.cruci-tablero-compacto .cruci-izq { flex: 0 0 auto; }
.cruci-activa {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 12px; border-radius: 12px;
    background: rgba(236, 72, 153, .14); border: 1px solid rgba(236, 72, 153, .45); font-size: 13.5px; line-height: 1.35; text-align: left;
}
.cruci-activa .cruci-boton { margin-left: auto; }
.cruci-activa-num { font: 700 14px/1 'Fredoka', 'Outfit', sans-serif; color: #fcd34d; white-space: nowrap; }
.cruci-hueco { flex: 1; min-height: 200px; display: flex; align-items: center; justify-content: center; }
.cruci-tablero-compacto .cruci-hueco { flex: 0 0 auto; min-height: 0; }
.cruci-rejilla { display: grid; gap: 3px; padding: 6px; border-radius: 14px; background: #020617; border: 1px solid #1e293b; box-shadow: inset 0 2px 10px rgba(0, 0, 0, .6); }
.cruci-vacia { display: block; }
.cruci-celda { position: relative; display: block; border-radius: 6px; background: #f3f4f6; border: 2px solid #cbd5e1; transition: background .2s, border-color .2s, box-shadow .2s; }
.cruci-celda input {
    width: 100%; height: 100%; box-sizing: border-box; border: 0; outline: 0; padding: 0; margin: 0; background: transparent;
    text-align: center; text-transform: uppercase; font-family: 'Fredoka', 'Outfit', sans-serif; font-weight: 600; color: #1e1b4b; caret-color: transparent; cursor: pointer;
}
.cruci-celda input::placeholder { color: #a78bfa; opacity: .8; }
.cruci-num { position: absolute; top: 1px; left: 3px; font-size: 9px; font-weight: 800; color: #6b21a8; pointer-events: none; line-height: 1; }
.cruci-en-palabra { background: #fce7f3; border-color: #ec4899; }
.cruci-cursor { outline: 3px solid #f59e0b; box-shadow: 0 0 12px rgba(245, 158, 11, .8); z-index: 1; }
.cruci-hecha { background: var(--color) !important; border-color: var(--color) !important; }
.cruci-hecha input { color: #fff; text-shadow: 0 0 4px rgba(0, 0, 0, .6); }
.cruci-hecha .cruci-num { color: #fff; }

.cruci-pistas { flex: 1 1 220px; min-width: 0; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; max-height: 100%; }
.cruci-pistas h4 { margin: 0 0 4px; font: 700 13px/1.2 'Fredoka', 'Outfit', sans-serif; color: #fcd34d; }
.cruci-pistas ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; }
.cruci-pistas button {
    width: 100%; text-align: left; font: 400 13px/1.35 'Outfit', var(--font-sans); color: #e2e8f0; cursor: pointer;
    padding: 6px 10px; border-radius: 10px; background: rgba(30, 41, 59, .7); border: 1px solid transparent;
}
.cruci-pistas button strong { color: #f9a8d4; }
.cruci-pista-activa { border-color: #ec4899 !important; background: rgba(236, 72, 153, .18) !important; }
.cruci-pista-hecha { opacity: .55; text-decoration: line-through; }

.cruci-fin {
    position: absolute; left: 0; right: 0; bottom: 10px; margin-inline: auto; width: max-content; max-width: calc(100% - 24px);
    background: rgba(30, 12, 50, .95) !important; box-shadow: 0 20px 50px -10px rgba(0, 0, 0, .8);
    display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; padding: 10px 14px; border-radius: 14px;
    background: linear-gradient(90deg, rgba(236, 72, 153, .25), rgba(249, 115, 22, .25)); border: 1px solid #f472b6;
}
.cruci-fin-texto { font-weight: 700; }
@media (prefers-reduced-motion: reduce) { .cruci-gran-titulo { animation: none; } }
`
