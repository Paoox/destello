/**
 * Destello — Actividad: Sopa de letras
 *
 * Basada en "Sopeando" de Paola (`mini-juegos/sopa_letras`), vuelta genérica:
 * las palabras llegan en `contenido`, así sirve igual para "partes de la oreja"
 * que para "ingredientes de las gomitas".
 *
 * ── Forma del contenido ──────────────────────────────────────────────────
 *
 *   {
 *     titulo: 'Animales',
 *     instrucciones: 'Encuentra los animales escondidos…',   // opcional
 *     palabras: ['LEON', 'TIGRE', …],      // acentos se ignoran, la Ñ se respeta
 *     cuantas: 10,         // opcional: cuántas sacar al azar de la lista (default: todas)
 *     tamano: 10,          // opcional: casillas por lado (default 10)
 *     diagonales: true,    // opcional (default true)
 *     alReves: false,      // opcional: palabras escritas de derecha a izquierda (default false)
 *   }
 *
 * ── Estado ───────────────────────────────────────────────────────────────
 *
 *   { tablero: { filas: ['ABCD…', …], palabras: [{ palabra, celdas: [[f, c], …] }] },
 *     pasos: { LEON: true, … }, tutorialHecho, ultimoCambio }
 *
 * El tablero se genera al empezar y se guarda en el estado, para que quien
 * vuelve a entrar (o la profe que lo revisa) vea exactamente la misma sopa.
 *
 * Sin tiempo límite: el original traía 5 minutos y pantalla de "se acabó el
 * tiempo". En el aula no — cada quien a su ritmo, como el resto.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { marcarCambio } from './contrato.js'
import { barajar, normalizarPalabra, useAltoDelPizarron, useTamano, COLORES_VIVOS } from './comun.js'
import logo from './sopa/logo.webp'

const LETRAS = 'AAAABCCDEEEEFGHIIIJLLMNNÑOOOOPQRRSSSTTUUVXYZ'

const TUTORIAL = { palabras: ['PIÑA', 'FRESA'], tamano: 6 }

/* ══════════════════════════════════════════════════════════════════════════
   El generador
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Acomoda las palabras en una cuadrícula. Las largas primero (son las que más
 * cuesta meter); si alguna no cabe, vuelve a empezar desde cero, y si después
 * de varios intentos sigue sin caber, la deja fuera — mejor una palabra menos
 * que una sopa que nunca carga.
 */
export function generarSopa(lista, tamano = 10, { diagonales = true, alReves = false } = {}) {
    const palabras = [...new Set(lista.map(normalizarPalabra))].filter(p => p.length >= 2 && p.length <= tamano)
    const direcciones = [[0, 1], [1, 0]]
    if (diagonales) direcciones.push([1, 1], [-1, 1])
    if (alReves) direcciones.push(...direcciones.map(([f, c]) => [-f, -c]))

    let mejor = null
    for (let intento = 0; intento < 40; intento++) {
        const rejilla = Array.from({ length: tamano }, () => Array(tamano).fill(''))
        const puestas = []
        for (const palabra of [...palabras].sort((a, b) => b.length - a.length)) {
            const celdas = colocar(rejilla, palabra, barajar(direcciones))
            if (celdas) puestas.push({ palabra, celdas })
        }
        if (!mejor || puestas.length > mejor.puestas.length) mejor = { rejilla, puestas }
        if (puestas.length === palabras.length) break
    }

    const filas = mejor.rejilla.map(fila =>
        fila.map(l => l || LETRAS[Math.floor(Math.random() * LETRAS.length)]).join(''))
    // En la lista, en el orden en que llegaron (no por largo).
    const orden = new Map(palabras.map((p, i) => [p, i]))
    return { filas, palabras: mejor.puestas.sort((a, b) => orden.get(a.palabra) - orden.get(b.palabra)) }
}

function colocar(rejilla, palabra, direcciones) {
    const n = rejilla.length
    const opciones = []
    for (const [df, dc] of direcciones) {
        for (let f = 0; f < n; f++) {
            for (let c = 0; c < n; c++) {
                const ff = f + df * (palabra.length - 1)
                const cf = c + dc * (palabra.length - 1)
                if (ff < 0 || ff >= n || cf < 0 || cf >= n) continue
                let cruces = 0
                let cabe = true
                for (let i = 0; i < palabra.length; i++) {
                    const actual = rejilla[f + df * i][c + dc * i]
                    if (actual && actual !== palabra[i]) { cabe = false; break }
                    if (actual) cruces++
                }
                if (cabe) opciones.push({ f, c, df, dc, cruces })
            }
        }
    }
    if (!opciones.length) return null
    // Un poco de preferencia por cruzarse con otras: se ve más "sopa".
    const conCruce = opciones.filter(o => o.cruces > 0)
    const pool = conCruce.length && Math.random() < 0.5 ? conCruce : opciones
    const elegida = pool[Math.floor(Math.random() * pool.length)]
    const celdas = []
    for (let i = 0; i < palabra.length; i++) {
        const f = elegida.f + elegida.df * i
        const c = elegida.c + elegida.dc * i
        rejilla[f][c] = palabra[i]
        celdas.push([f, c])
    }
    return celdas
}

/** Las casillas en línea recta de `a` a `b`, o `null` si no es recta. */
function linea(a, b) {
    const df = b[0] - a[0]
    const dc = b[1] - a[1]
    if (df !== 0 && dc !== 0 && Math.abs(df) !== Math.abs(dc)) return null
    const pasos = Math.max(Math.abs(df), Math.abs(dc))
    const sf = Math.sign(df)
    const sc = Math.sign(dc)
    return Array.from({ length: pasos + 1 }, (_, i) => [a[0] + sf * i, a[1] + sc * i])
}

const mismaLinea = (x, y) => x.length === y.length && x.every((p, i) => p[0] === y[i][0] && p[1] === y[i][1])

/**
 * El tablero guardado, solo si de verdad es de una sopa. Si el estado trae el
 * de otra actividad (un crucigrama, por ejemplo), se ignora y se arranca de
 * cero en vez de tronar.
 */
const tableroDe = (estado) => {
    const t = estado?.tablero
    return Array.isArray(t?.filas) && Array.isArray(t?.palabras) && t.palabras.every(p => Array.isArray(p?.celdas)) ? t : null
}

/** Resumen para la miniatura de la profe. */
export function resumen(contenido, estado) {
    const palabras = tableroDe(estado)?.palabras
    if (!palabras) return { avance: 0, etiqueta: 'sin empezar', terminado: false }
    const hechas = palabras.filter(p => estado?.pasos?.[p.palabra]).length
    return {
        avance:    palabras.length ? Math.round((hechas / palabras.length) * 100) : 0,
        etiqueta:  `${hechas} de ${palabras.length} palabras`,
        terminado: palabras.length > 0 && hechas >= palabras.length,
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   La actividad
   ══════════════════════════════════════════════════════════════════════════ */

export default function Sopa({ contenido, estado, onCambio, liberado, esProfe }) {
    const raiz = useRef(null)
    const alto = useAltoDelPizarron(raiz)
    const [fase, setFase] = useState('instrucciones')
    const [verReglas, setVerReglas] = useState(false)
    const [verTodas, setVerTodas] = useState(false)

    const lista = contenido?.palabras ?? []
    const tablero = tableroDe(estado)
    const encontradas = estado?.pasos ?? {}
    const empezado = !!tablero
    const toque = () => onCambio(marcarCambio(estado, {}))

    const empezar = (extra = {}) => {
        if (!liberado) return
        const elegidas = contenido?.cuantas ? barajar(lista).slice(0, contenido.cuantas) : lista
        const nuevo = generarSopa(elegidas, contenido?.tamano ?? 10, contenido ?? {})
        setVerReglas(false)
        onCambio(marcarCambio(estado, { tablero: nuevo, pasos: {}, ...extra }))
    }

    if (!lista.length) {
        return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Esta sopa de letras todavía no tiene palabras.</p>
    }

    const total = tablero?.palabras.length ?? 0
    const hechas = tablero ? tablero.palabras.filter(p => encontradas[p.palabra]).length : 0
    const terminado = empezado && hechas >= total
    const puedeSaltar = esProfe || estado?.tutorialHecho

    let pantalla
    if (empezado && !verReglas) {
        pantalla = (
            <div className="sopa-juego">
                <Tablero
                    key={tablero.filas.join('')}
                    tablero={tablero}
                    encontradas={encontradas}
                    verTodas={verTodas}
                    bloqueado={!liberado || terminado}
                    onEncontrada={(palabra) => onCambio(marcarCambio(estado, { pasos: { ...encontradas, [palabra]: true } }))}
                    onToque={toque}
                />
                {terminado && (
                    <div className="sopa-fin">
                        <img src={logo} alt="" />
                        <strong>¡Encontraste las {total} palabras!</strong>
                        <button className="sopa-boton" onClick={() => empezar()} disabled={!liberado}>Otra sopa</button>
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
            <div className="sopa-panel sopa-scroll">
                <img className="sopa-logo" src={logo} alt="Sopeando" />
                <p className="sopa-intro">
                    {contenido?.instrucciones ?? 'Encuentra todas las palabras escondidas en la cuadrícula.'}
                </p>
                <div className="sopa-reglas">
                    <h3>Reglas rápidas</h3>
                    <ul>
                        <li><strong>Busca:</strong> {contenido?.cuantas ?? lista.length} palabras escondidas en la sopa.</li>
                        <li>
                            <strong>Direcciones:</strong> horizontal, vertical
                            {(contenido?.diagonales ?? true) && ' y en diagonal'}
                            {contenido?.alReves && ' — y algunas al revés'}.
                        </li>
                        <li><strong>Para marcar:</strong> arrastra de la primera letra a la última, o toca la primera y luego la última.</li>
                        <li><strong>A tu ritmo:</strong> no hay tiempo límite.</li>
                    </ul>
                </div>
                <div className="sopa-acciones">
                    {verReglas ? (
                        <button className="sopa-boton" onClick={() => setVerReglas(false)}>Volver al juego</button>
                    ) : (
                        <>
                            <button className="sopa-boton" onClick={() => { setFase('tutorial'); toque() }} disabled={!liberado}>¿Cómo jugar?</button>
                            {puedeSaltar && (
                                <button className="sopa-boton sopa-boton-sutil" onClick={() => empezar()} disabled={!liberado}>Ya sé jugar</button>
                            )}
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div ref={raiz} className="sopa" style={{ height: alto ?? undefined, opacity: liberado ? 1 : 0.55 }}>
            <style>{CSS}</style>
            <div className="sopa-cabeza">
                {contenido?.titulo && <span className="sopa-titulo">{contenido.titulo}</span>}
                {empezado && !verReglas && <span className="sopa-cuenta">{hechas}/{total} palabras</span>}
                {empezado && !verReglas && (
                    <button className="sopa-boton sopa-boton-sutil" onClick={() => setVerReglas(true)}>Reglas</button>
                )}
                {esProfe && empezado && !verReglas && (
                    <button className="sopa-boton sopa-boton-sutil" onClick={() => setVerTodas(v => !v)}>
                        {verTodas ? 'Ocultar' : 'Ver soluciones'}
                    </button>
                )}
            </div>
            {pantalla}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Tutorial: una sopita de 6×6 con PIÑA y FRESA
   ══════════════════════════════════════════════════════════════════════════ */

function Tutorial({ liberado, puedeSaltar, onToque, onTerminar, onVolver }) {
    const [ronda, setRonda] = useState(0)
    const tablero = useMemo(() => generarSopa(TUTORIAL.palabras, TUTORIAL.tamano, { diagonales: false }), [ronda])
    const [encontradas, setEncontradas] = useState({})
    const lista = Object.keys(encontradas).length >= tablero.palabras.length

    return (
        <div className="sopa-panel sopa-panel-tuto">
            <h2 className="sopa-subtitulo">¿Cómo se juega?</h2>
            <p className="sopa-intro">
                Arrastra el dedo o el mouse <strong>desde la primera letra hasta la última</strong> de
                cada palabra. También puedes tocar la primera letra y luego la última.
            </p>
            <Tablero
                key={ronda}
                tablero={tablero}
                encontradas={encontradas}
                bloqueado={!liberado}
                compacto
                onEncontrada={(p) => { onToque(); setEncontradas(e => ({ ...e, [p]: true })) }}
                onToque={onToque}
            />
            <div className="sopa-acciones">
                <button className="sopa-boton" onClick={onTerminar} disabled={!liberado || !(lista || puedeSaltar)}>
                    ¡Entendido, a jugar!
                </button>
                {lista && (
                    <button className="sopa-boton sopa-boton-sutil" onClick={() => { setEncontradas({}); setRonda(r => r + 1) }}>
                        Practicar otra vez
                    </button>
                )}
                <button className="sopa-boton sopa-boton-sutil" onClick={onVolver}>Ver reglas</button>
            </div>
            {!lista && !puedeSaltar && <p className="sopa-candado">Encuentra PIÑA y FRESA para continuar</p>}
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   El tablero — lo usan el juego y el tutorial
   ══════════════════════════════════════════════════════════════════════════ */

function Tablero({ tablero, encontradas, verTodas = false, bloqueado, compacto = false, onEncontrada, onToque }) {
    const { filas, palabras } = tablero
    const n = filas.length
    const hueco = useRef(null)
    const { w, h } = useTamano(hueco)
    // El tamaño de casilla sale del hueco disponible; ni diminuta ni gigante.
    // (El del tutorial va fijo: su hueco se mide por su propio contenido.)
    const casilla = compacto ? 38 : Math.max(24, Math.min(52, Math.floor((Math.min(w || 400, h || 400) - 16) / n) - 3))

    // La selección en curso vive en una ref (los eventos del puntero pueden
    // llegar más rápido que los renders) y un contador fuerza el repintado.
    const sel = useRef({ inicio: null, fin: null, arrastrando: false })
    const [, repintar] = useState(0)
    const fijar = (cambios) => { Object.assign(sel.current, cambios); repintar(n => n + 1) }
    const { inicio, fin } = sel.current
    const [error, setError] = useState(false)

    const colorDe = useMemo(() => {
        const m = {}
        palabras.forEach((p, i) => { m[p.palabra] = COLORES_VIVOS[i % COLORES_VIVOS.length] })
        return m
    }, [palabras])

    // Qué color pintar en cada casilla: la última palabra encontrada que pasa por ahí.
    const pintadas = useMemo(() => {
        const m = {}
        for (const p of palabras) {
            if (!encontradas[p.palabra] && !verTodas) continue
            for (const [f, c] of p.celdas) m[`${f},${c}`] = encontradas[p.palabra] ? colorDe[p.palabra] : 'fantasma'
        }
        return m
    }, [palabras, encontradas, verTodas, colorDe])

    const seleccion = inicio && fin ? linea(inicio, fin) ?? [inicio] : inicio ? [inicio] : []
    const enSeleccion = new Set(seleccion.map(([f, c]) => `${f},${c}`))

    useEffect(() => {
        if (!error) return
        const t = setTimeout(() => setError(false), 350)
        return () => clearTimeout(t)
    }, [error])

    const celdaEn = (x, y) => {
        const el = document.elementFromPoint(x, y)?.closest?.('[data-celda]')
        return el ? el.dataset.celda.split(',').map(Number) : null
    }

    const evaluar = (a, b) => {
        const linea_ = linea(a, b)
        fijar({ inicio: null, fin: null, arrastrando: false })
        if (!linea_ || linea_.length < 2) return
        const hallada = palabras.find(p => !encontradas[p.palabra]
            && (mismaLinea(p.celdas, linea_) || mismaLinea(p.celdas, [...linea_].reverse())))
        if (hallada) onEncontrada(hallada.palabra)
        else { setError(true); onToque?.() }
    }

    const alBajar = (e) => {
        if (bloqueado) return
        const celda = celdaEn(e.clientX, e.clientY)
        if (!celda) return
        e.currentTarget.setPointerCapture?.(e.pointerId)
        const s = sel.current
        // Segundo toque del modo "toca la primera y la última".
        if (s.inicio && !s.arrastrando) {
            if (celda[0] === s.inicio[0] && celda[1] === s.inicio[1]) fijar({ inicio: null, fin: null })
            else evaluar(s.inicio, celda)
            return
        }
        fijar({ inicio: celda, fin: celda, arrastrando: true })
    }
    const alMover = (e) => {
        const s = sel.current
        if (!s.arrastrando) return
        const celda = celdaEn(e.clientX, e.clientY)
        if (celda && linea(s.inicio, celda) && (celda[0] !== s.fin[0] || celda[1] !== s.fin[1])) fijar({ fin: celda })
    }
    const alSoltar = () => {
        const s = sel.current
        if (!s.arrastrando) return
        // Si soltó en la misma casilla, queda esperando el segundo toque.
        if (s.fin[0] !== s.inicio[0] || s.fin[1] !== s.inicio[1]) evaluar(s.inicio, s.fin)
        else fijar({ arrastrando: false })
    }

    return (
        <div className={`sopa-tablero ${compacto ? 'sopa-tablero-compacto' : ''}`}>
            <div ref={hueco} className="sopa-hueco">
                <div
                    className={`sopa-rejilla ${error ? 'sopa-error' : ''}`}
                    style={{ gridTemplateColumns: `repeat(${n}, ${casilla}px)`, fontSize: Math.round(casilla * 0.5) }}
                    onPointerDown={alBajar}
                    onPointerMove={alMover}
                    onPointerUp={alSoltar}
                    onPointerCancel={() => fijar({ inicio: null, fin: null, arrastrando: false })}
                    role="grid"
                    aria-label="Sopa de letras"
                >
                    {filas.map((fila, f) => [...fila].map((letra, c) => {
                        const k = `${f},${c}`
                        const color = pintadas[k]
                        return (
                            <span
                                key={k}
                                data-celda={k}
                                role="gridcell"
                                className={`sopa-celda ${enSeleccion.has(k) ? 'sopa-sel' : ''} ${color === 'fantasma' ? 'sopa-fantasma' : color ? 'sopa-hallada' : ''}`}
                                style={color && color !== 'fantasma' ? { '--color': color } : undefined}
                            >{letra}</span>
                        )
                    }))}
                </div>
            </div>
            <ul className="sopa-lista">
                {palabras.map(p => (
                    <li key={p.palabra} className={encontradas[p.palabra] ? 'sopa-lista-hecha' : ''} style={{ '--color': colorDe[p.palabra] }}>
                        {encontradas[p.palabra] ? '✓ ' : ''}{p.palabra}
                    </li>
                ))}
            </ul>
        </div>
    )
}

/* ── Estilos ────────────────────────────────────────────────────────────────
   Los colores del original: fondo pizarra con destellos, tarjeta blanca de
   vidrio, selección amarilla y un color vivo por palabra encontrada. Siempre
   oscuro (como el caso), sin importar el tema del aula. Prefijo `sopa-`. */
const CSS = `
.sopa {
    width: 100%; display: flex; flex-direction: column; gap: 10px; padding: 12px; box-sizing: border-box;
    font-family: 'Outfit', var(--font-sans); color: #f1f5f9; border-radius: 16px; overflow: hidden;
    background:
        radial-gradient(circle at 10% 10%, rgba(236, 72, 153, .22), transparent 40%),
        radial-gradient(circle at 90% 90%, rgba(6, 182, 212, .2), transparent 45%),
        #0f172a;
    user-select: none; -webkit-user-select: none;
}
.sopa-cabeza { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; min-height: 28px; }
.sopa-titulo { font-weight: 700; font-size: 15px; }
.sopa-cuenta { margin-left: auto; font-weight: 700; font-size: 13px; color: #fde047; }
.sopa-boton {
    font: 800 14px/1 'Outfit', var(--font-sans); padding: 11px 20px; border-radius: 14px; border: 0; cursor: pointer; color: #fff;
    background: linear-gradient(90deg, #4f46e5, #7c3aed); box-shadow: 0 6px 18px -6px rgba(99, 102, 241, .7);
    transition: transform .15s;
}
.sopa-boton:hover:not(:disabled) { transform: translateY(-1px); }
.sopa-boton:disabled { cursor: not-allowed; filter: grayscale(.7); opacity: .6; }
.sopa-boton-sutil { padding: 6px 12px; font-size: 12px; font-weight: 600; background: rgba(255, 255, 255, .08); border: 1px solid rgba(255, 255, 255, .22); box-shadow: none; }
.sopa-panel .sopa-boton-sutil { color: #4f46e5; background: #eef2ff; border-color: #c7d2fe; }
.sopa-acciones { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; align-items: center; }

.sopa-juego { flex: 1; min-height: 0; overflow-y: auto; position: relative; }
/* Los paneles de leer: de su tamaño, centrados, y con scroll solo si no caben. */
.sopa-scroll { flex: 0 1 auto; min-height: 0; overflow-y: auto; margin-block: auto; }
.sopa-panel {
    width: 100%; max-width: 640px; margin: 0 auto; box-sizing: border-box;
    display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center;
    padding: 16px clamp(12px, 3vw, 26px); border-radius: 20px;
    background: rgba(255, 255, 255, .96); color: #1e293b;
    box-shadow: 0 20px 50px -20px rgba(0, 0, 0, .6);
}
.sopa-panel-tuto { flex: 0 1 auto; min-height: 0; overflow-y: auto; margin-block: auto; max-width: 760px; }
.sopa-logo { width: min(260px, 70%); height: auto; }
.sopa-subtitulo { margin: 0; font: 700 22px/1.1 'Fredoka', 'Outfit', sans-serif; color: #4f46e5; }
.sopa-intro { margin: 0; max-width: 56ch; font-size: 14px; line-height: 1.45; color: #475569; }
.sopa-reglas { width: 100%; max-width: 520px; text-align: left; padding: 10px 14px; border-radius: 14px; background: #eef2ff; border: 1px solid #c7d2fe; }
.sopa-reglas h3 { margin: 0 0 6px; font: 700 13px/1.2 'Fredoka', 'Outfit', sans-serif; letter-spacing: .04em; color: #7c3aed; text-transform: uppercase; }
.sopa-reglas ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
.sopa-reglas li { font-size: 13px; line-height: 1.4; }
.sopa-reglas li::marker { color: #ec4899; }
.sopa-candado { margin: 0; font-size: 12px; color: #64748b; }

/* ── Tablero ── */
.sopa-tablero { flex: 1; min-height: 0; width: 100%; display: flex; gap: 14px; align-items: stretch; justify-content: center; flex-wrap: wrap; }
.sopa-tablero-compacto { flex: 0 0 auto; }
.sopa-juego .sopa-tablero { height: 100%; }
.sopa-hueco { flex: 1 1 300px; min-width: 0; min-height: 220px; display: flex; align-items: center; justify-content: center; }
.sopa-tablero-compacto .sopa-hueco { flex: 0 0 auto; min-height: 0; }
.sopa-rejilla {
    display: grid; gap: 3px; padding: 8px; border-radius: 16px; touch-action: none; cursor: pointer;
    background: rgba(255, 255, 255, .96); box-shadow: 0 16px 40px -16px rgba(0, 0, 0, .6);
}
.sopa-tablero-compacto .sopa-rejilla { background: #f1f5f9; box-shadow: inset 0 0 0 1px #e2e8f0; }
.sopa-error { animation: sopa-temblor .3s; }
@keyframes sopa-temblor { 25% { transform: translateX(4px); } 75% { transform: translateX(-4px); } }
.sopa-celda {
    aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
    border-radius: 8px; background: #f1f5f9; color: #1e293b; font-weight: 700;
    transition: background .15s, color .15s, transform .15s;
}
.sopa-tablero-compacto .sopa-celda { background: #fff; }
.sopa-hallada { background: var(--color) !important; color: #fff !important; font-weight: 800; animation: sopa-pop .3s cubic-bezier(.175, .885, .32, 1.275); }
@keyframes sopa-pop { 0% { transform: scale(.6); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
.sopa-fantasma { box-shadow: inset 0 0 0 2px #a78bfa; }
.sopa-sel { background: #fde047 !important; color: #1e293b !important; transform: scale(1.06); font-weight: 800; }

.sopa-lista {
    flex: 0 1 200px; margin: 0; padding: 0; list-style: none; align-self: center;
    display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; align-content: center;
}
.sopa-lista li {
    padding: 6px 12px; border-radius: 999px; font-weight: 700; font-size: 13px; letter-spacing: .04em;
    background: rgba(255, 255, 255, .1); border: 1px solid rgba(255, 255, 255, .2);
}
.sopa-tablero-compacto .sopa-lista li { background: #eef2ff; border-color: #c7d2fe; color: #4f46e5; }
.sopa-lista li.sopa-lista-hecha { background: var(--color); border-color: var(--color); color: #fff; }

.sopa-fin {
    /* Encima del tablero, abajo al centro: se ve sin tener que bajar. */
    position: absolute; left: 0; right: 0; margin-inline: auto; bottom: 12px; width: max-content; max-width: calc(100% - 24px);
    box-shadow: 0 20px 50px -10px rgba(0, 0, 0, .7); animation: sopa-pop .4s cubic-bezier(.175, .885, .32, 1.275);
    display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap;
    padding: 10px 14px; border-radius: 16px; background: rgba(255, 255, 255, .96); color: #1e293b;
}
.sopa-fin img { height: 36px; width: auto; }

@media (prefers-reduced-motion: reduce) { .sopa-hallada, .sopa-error { animation: none; } }
`
