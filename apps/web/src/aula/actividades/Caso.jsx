/**
 * Destello — Actividad: Caso (decisiones paso a paso, con modelo 3D opcional)
 *
 * Basada en el juego "Decisiones — Auriculoterapia para insomnio" de Paola
 * (`mini-juegos/desiciones_auriculoterapia`), vuelta genérica: el caso, los
 * pasos, las opciones y los finales llegan en `contenido`. Sirve para un caso
 * clínico sobre la oreja 3D, pero también para "arma tu rutina de skincare"
 * sin modelo: si no hay `modelo`, se muestran solo las decisiones.
 *
 * ── Forma del contenido ──────────────────────────────────────────────────
 *
 *   {
 *     titulo: 'Reto clínico: tratamiento de insomnio',
 *     introduccion: 'Tu paciente Roberto, 42 años, …',
 *     datos: [{ etiqueta: 'Síntoma clave', valor: 'Insomnio y agitación' }],
 *     modelo: { url: '/contenido/…/oreja.glb', rotacion: [0, 0, 0], espejo: false },  // opcional
 *     marcadores: [{ id: 'semilla', nombre: 'Semilla de vaccaria' }, …],   // opcional
 *     pasos: [{
 *       id: 'p1', titulo: 'Punto ansiolítico principal',
 *       pregunta: '¿Qué punto…?', descripcion: '…',
 *       opciones: [{ id: 'shenmen', titulo: 'Shen Men', descripcion: '…',
 *                    correcta: true, punto: { x: 46, y: 22 } }],
 *     }],
 *     procesando: { titulo: 'Aplicando estimulación…', texto: '…' },     // opcional
 *     resultados: [   // de mayor a menor `minimo` de aciertos
 *       { minimo: 7, tono: 'bien', insignia: '…', titulo: '…', descripcion: '…', estado: '…', video: '/…mp4' },
 *     ],
 *   }
 *
 * `punto` es el lugar en el modelo, en % visto de frente (ver Visor3D). Para
 * sacarlo, la profe tiene el botón "Coordenadas": clic en el modelo y te dice
 * el `{ x, y }`.
 *
 * ── Estado ───────────────────────────────────────────────────────────────
 *
 *   { pasos: { p1: 'shenmen', … }, marcador: 'semilla', ultimoCambio }
 *
 * ── Igual que el Quiz: no se califica al vuelo ───────────────────────────
 *
 * El juego original pintaba cada punto de color "bien/mal" en cuanto se
 * colocaba. Aquí no: los puntos se ven todos iguales y el resultado sale al
 * final, con el repaso de qué tocaba en cada paso. Mientras tanto se puede
 * volver a cualquier paso (los puntitos de arriba) y cambiar la decisión.
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { marcarCambio } from './contrato.js'
import { useAltoDelPizarron } from './comun.js'

// El visor trae three.js: que solo se descargue cuando de verdad se abre un caso con modelo.
const Visor3D = lazy(() => import('../visor3d/Visor3D.jsx'))

const MARCADORES_POR_DEFECTO = [{ id: 'punto', nombre: 'Marca' }]

/** Resumen para la miniatura de la profe. */
export function resumen(contenido, estado) {
    const pasos = contenido?.pasos ?? []
    if (!pasos.length) return { avance: 0, etiqueta: 'sin pasos', terminado: false }
    const hechos = pasos.filter(p => estado?.pasos?.[p.id]).length
    return {
        avance:    Math.round((hechos / pasos.length) * 100),
        etiqueta:  hechos === 0 ? 'sin empezar' : `${hechos} de ${pasos.length}`,
        terminado: hechos >= pasos.length,
    }
}

/** Aciertos y el resultado que le toca. */
function calificar(contenido, elegidas) {
    const pasos = contenido?.pasos ?? []
    const aciertos = pasos.filter(p => p.opciones.find(o => o.id === elegidas[p.id])?.correcta).length
    const resultados = [...(contenido?.resultados ?? [])].sort((a, b) => b.minimo - a.minimo)
    const resultado = resultados.find(r => aciertos >= r.minimo) ?? resultados[resultados.length - 1] ?? null
    return { aciertos, total: pasos.length, resultado }
}

export default function Caso({ contenido, estado, onCambio, liberado, esProfe }) {
    const pasos = contenido?.pasos ?? []
    const elegidas = estado?.pasos ?? {}
    const marcadores = contenido?.marcadores?.length ? contenido.marcadores : MARCADORES_POR_DEFECTO
    const marcador = marcadores.find(m => m.id === estado?.marcador)?.id ?? marcadores[0].id
    const hechos = pasos.filter(p => elegidas[p.id]).length
    const terminado = pasos.length > 0 && hechos >= pasos.length

    const primeroSinHacer = () => Math.max(0, pasos.findIndex(p => !elegidas[p.id]))
    const [pantalla, setPantalla] = useState(() => (terminado ? 'resultado' : hechos ? 'juego' : 'intro'))
    const [indice, setIndice] = useState(primeroSinHacer)
    const [previa, setPrevia] = useState(null)        // opción bajo el cursor → aro en el modelo
    const [calibrar, setCalibrar] = useState(false)
    const [coordenada, setCoordenada] = useState(null)
    const ultimoAviso = useRef(0)
    const raiz = useRef(null)
    const alto = useAltoDelPizarron(raiz)

    // Si la profe abre el pizarrón de otra persona (o se reinicia por fuera),
    // ponerse en el paso correcto de ESE estado.
    const llave = JSON.stringify(elegidas)
    useEffect(() => {
        if (terminado) setPantalla(p => (p === 'procesando' ? p : 'resultado'))
        else setIndice(primeroSinHacer())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [llave])

    if (!pasos.length) {
        return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Este caso todavía no tiene pasos.</p>
    }

    // Girar el modelo ES interactuar (contrato): se avisa, pero a lo mucho cada
    // 3 segundos, para no inundar el canal con cada arrastre.
    const avisarInteraccion = () => {
        const ahora = Date.now()
        if (ahora - ultimoAviso.current < 3000) return
        ultimoAviso.current = ahora
        onCambio(marcarCambio(estado, {}))
    }

    const paso = pasos[Math.min(indice, pasos.length - 1)]

    const elegir = (opcion) => {
        if (!liberado) return
        const nuevas = { ...elegidas, [paso.id]: opcion.id }
        onCambio(marcarCambio(estado, { pasos: nuevas }))
        setPrevia(null)
        const siguiente = pasos.findIndex(p => !nuevas[p.id])
        if (siguiente === -1) {
            setPantalla('procesando')
            setTimeout(() => setPantalla('resultado'), 1300)
        } else {
            setIndice(siguiente)
        }
    }

    const cambiarMarcador = (id) => onCambio(marcarCambio(estado, { marcador: id }))
    const reintentar = () => {
        onCambio(marcarCambio(estado, { pasos: {} }))
        setIndice(0)
        setPantalla('juego')
    }

    const puntos = pasos
        .map(p => p.opciones.find(o => o.id === elegidas[p.id]))
        .filter(o => o?.punto)
        .map(o => ({ id: o.id, x: o.punto.x, y: o.punto.y, estilo: marcador }))

    const conModelo = !!contenido?.modelo?.url

    return (
        <div ref={raiz} className="caso" style={{ opacity: liberado ? 1 : 0.6, height: alto ?? undefined }}>
            <style>{CSS}</style>

            {pantalla === 'intro' && (
                <Intro contenido={contenido} liberado={liberado} onEmpezar={() => { setPantalla('juego'); avisarInteraccion() }} />
            )}

            {pantalla === 'procesando' && (
                <div className="caso-procesando">
                    <div className="caso-pulso" />
                    <h3>{contenido?.procesando?.titulo ?? 'Evaluando tus decisiones'}</h3>
                    <p>{contenido?.procesando?.texto ?? 'Un momento…'}</p>
                    <div className="caso-barra"><div /></div>
                </div>
            )}

            {pantalla === 'resultado' && (
                <Resultado contenido={contenido} elegidas={elegidas} liberado={liberado} onReintentar={reintentar} />
            )}

            {pantalla === 'juego' && (
                <div className={`caso-juego${conModelo ? '' : ' caso-sin-modelo'}`}>
                    {conModelo && (
                        <div className="caso-visor">
                            <div className="caso-visor-cabeza">
                                <div className="caso-pastillas">
                                    {marcadores.length > 1 && marcadores.map(m => (
                                        <button key={m.id} className={m.id === marcador ? 'activa' : ''}
                                            onClick={() => cambiarMarcador(m.id)} disabled={!liberado}>
                                            {m.nombre}
                                        </button>
                                    ))}
                                </div>
                                {esProfe && (
                                    <button className={`caso-coord${calibrar ? ' activa' : ''}`} onClick={() => { setCalibrar(c => !c); setCoordenada(null) }}>
                                        {calibrar ? (coordenada ? `{ x: ${coordenada.x}, y: ${coordenada.y} }` : 'Clic en el modelo…') : 'Coordenadas'}
                                    </button>
                                )}
                            </div>
                            <div className="caso-visor-lienzo">
                                <Suspense fallback={<div className="caso-cargando">Preparando el modelo 3D…</div>}>
                                    <Visor3D
                                        url={contenido.modelo.url}
                                        rotacion={contenido.modelo.rotacion}
                                        espejo={contenido.modelo.espejo}
                                        puntos={puntos}
                                        objetivo={previa?.punto ?? null}
                                        bloqueado={!liberado}
                                        calibrar={calibrar}
                                        onCalibrar={setCoordenada}
                                        onInteraccion={avisarInteraccion}
                                    />
                                </Suspense>
                            </div>
                        </div>
                    )}

                    <div className="caso-panel">
                        <div className="caso-progreso">
                            <span className="caso-insignia">Paso {indice + 1} de {pasos.length}</span>
                            <div className="caso-puntitos">
                                {pasos.map((p, i) => (
                                    <button key={p.id} title={`Paso ${i + 1}`}
                                        className={`${i === indice ? 'actual' : ''}${elegidas[p.id] ? ' hecho' : ''}`}
                                        onClick={() => { setIndice(i); setPrevia(null); avisarInteraccion() }} />
                                ))}
                            </div>
                        </div>

                        <h3 className="caso-titulo">{paso.titulo}</h3>
                        <p className="caso-pregunta">{paso.pregunta}</p>
                        {paso.descripcion && <p className="caso-desc">{paso.descripcion}</p>}

                        <div className="caso-opciones">
                            {paso.opciones.map(o => {
                                const elegida = elegidas[paso.id] === o.id
                                return (
                                    <button key={o.id}
                                        className={`caso-opcion${elegida ? ' elegida' : ''}`}
                                        onMouseEnter={() => o.punto && setPrevia(o)}
                                        onMouseLeave={() => setPrevia(null)}
                                        onFocus={() => o.punto && setPrevia(o)}
                                        onBlur={() => setPrevia(null)}
                                        onClick={() => elegir(o)}
                                        disabled={!liberado}>
                                        <span className="caso-radio" />
                                        <span className="caso-opcion-texto">
                                            <strong>{o.titulo}</strong>
                                            {o.descripcion && <small>{o.descripcion}</small>}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        {hechos > 0 && (
                            <div className="caso-colocados">
                                <span>Colocados ({hechos}/{pasos.length}):</span>
                                {pasos.filter(p => elegidas[p.id]).map((p, i) => (
                                    <em key={p.id}>{i + 1}. {nombreCorto(p.opciones.find(o => o.id === elegidas[p.id])?.titulo)}</em>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

/** "Punto Shen Men" → "Shen Men": en la lista de colocados sobra el "Punto". */
const nombreCorto = (t = '') => t.replace(/^punto\s+/i, '')

function Intro({ contenido, liberado, onEmpezar }) {
    return (
        <div className="caso-intro">
            <span className="caso-insignia">Caso práctico</span>
            <h2>{contenido?.titulo ?? 'Caso práctico'}</h2>
            {contenido?.introduccion && <p>{contenido.introduccion}</p>}
            {contenido?.datos?.length > 0 && (
                <div className="caso-datos">
                    {contenido.datos.map(d => (
                        <div key={d.etiqueta}><small>{d.etiqueta}</small><strong>{d.valor}</strong></div>
                    ))}
                </div>
            )}
            <p className="caso-nota">
                Elige una opción en cada paso{contenido?.modelo?.url ? ' — al pasar el cursor verás en el modelo dónde va' : ''}.
                El resultado aparece al final y puedes regresar a cualquier paso para cambiar tu decisión.
            </p>
            <button className="caso-boton" onClick={onEmpezar} disabled={!liberado}>Empezar</button>
        </div>
    )
}

function Resultado({ contenido, elegidas, liberado, onReintentar }) {
    const { aciertos, total, resultado } = calificar(contenido, elegidas)
    const tono = resultado?.tono ?? (aciertos === total ? 'bien' : aciertos >= total / 2 ? 'medio' : 'mal')
    return (
        <div className={`caso-resultado tono-${tono}`}>
            <div className="caso-resultado-arriba">
                {resultado?.video && (
                    <video className="caso-video" src={resultado.video} autoPlay loop muted playsInline preload="auto" />
                )}
                <div className="caso-resultado-texto">
                    {resultado?.insignia && <span className="caso-etiqueta">{resultado.insignia}</span>}
                    <h2>{resultado?.titulo ?? `${aciertos} de ${total}`}</h2>
                    {resultado?.descripcion && <p>{resultado.descripcion}</p>}
                    <div className="caso-cifras">
                        <div><small>Aciertos</small><strong>{aciertos} / {total}</strong></div>
                        <div><small>Eficacia</small><strong>{Math.round((aciertos / total) * 100)}%</strong></div>
                        {resultado?.estado && <div><small>Estado</small><strong>{resultado.estado}</strong></div>}
                    </div>
                </div>
            </div>

            <div className="caso-repaso">
                <h3>Repaso</h3>
                {(contenido?.pasos ?? []).map((p, i) => {
                    const elegida = p.opciones.find(o => o.id === elegidas[p.id])
                    const buena = p.opciones.find(o => o.correcta)
                    const bien = elegida?.correcta
                    return (
                        <div key={p.id} className={`caso-repaso-fila ${bien ? 'bien' : 'mal'}`}>
                            <span className="caso-repaso-n">{i + 1}</span>
                            <span>
                                <strong>{p.titulo}:</strong> {elegida ? nombreCorto(elegida.titulo) : '—'}
                                {!bien && buena && <> · <em>tocaba {nombreCorto(buena.titulo)}</em></>}
                            </span>
                        </div>
                    )
                })}
            </div>

            <button className="caso-boton" onClick={onReintentar} disabled={!liberado}>Reintentar</button>
        </div>
    )
}

const CSS = `
/* El caso es oscuro SIEMPRE, como el juego original: el modelo 3D luce sobre
   fondo oscuro y así no depende de si el aula está en tema claro u oscuro. */
.caso {
    width: 100%; height: 100%; min-height: 0; padding: 12px 46px 12px 12px; box-sizing: border-box;
    /* 46px a la derecha: ahí el aula pone su columna de botones (candado, capas…) */
    display: flex; flex-direction: column; font-family: var(--font-sans); color: #e2e8f0;
    background: linear-gradient(135deg, #070d18 0%, #0d1527 50%, #062b24 100%);
    border-radius: 14px;
}
.caso-boton {
    align-self: center; padding: 10px 22px; border-radius: 999px; border: 0; cursor: pointer;
    font: 700 13px/1 var(--font-sans); letter-spacing: .04em; color: #042f2e;
    background: linear-gradient(45deg, #2dd4bf, #5eead4); box-shadow: 0 6px 20px -6px rgba(45, 212, 191, .7);
}
.caso-boton:disabled { opacity: .5; cursor: not-allowed; }
.caso-insignia {
    display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 10px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase; color: #5eead4;
    background: rgba(45, 212, 191, .12); border: 1px solid rgba(45, 212, 191, .35);
}

/* ── Intro ── */
.caso-intro {
    margin: auto; max-width: 640px; display: flex; flex-direction: column; align-items: center; gap: 12px;
    text-align: center; padding: 22px; border-radius: 20px;
    background: rgba(15, 23, 42, .88); border: 1px solid rgba(45, 212, 191, .3);
}
.caso-intro h2 { margin: 0; font-size: clamp(19px, 2.6vw, 26px); color: #fff; }
.caso-intro p { margin: 0; font-size: 13.5px; line-height: 1.55; color: #cbd5e1; max-width: 52ch; }
.caso-intro .caso-nota { font-size: 12px; color: #94a3b8; }
.caso-datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; width: 100%; }
.caso-datos div {
    display: flex; flex-direction: column; gap: 3px; text-align: left; padding: 9px 12px; border-radius: 12px;
    background: rgba(2, 6, 23, .6); border: 1px solid #1e293b;
}
.caso-datos small { font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #2dd4bf; }
.caso-datos strong { font-size: 13px; color: #e2e8f0; }

/* ── Juego: modelo a la izquierda, decisiones a la derecha ── */
.caso-juego {
    flex: 1; min-height: 0; display: grid; gap: 12px;
    grid-template-columns: minmax(0, 1fr) minmax(240px, 1fr);
}
.caso-sin-modelo { grid-template-columns: minmax(0, 560px); justify-content: center; }
@media (max-width: 760px) {
    .caso-juego { grid-template-columns: 1fr; grid-template-rows: minmax(220px, 45%) 1fr; }
}
.caso-visor { min-height: 0; display: flex; flex-direction: column; gap: 6px; }
.caso-visor-cabeza { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.caso-visor-lienzo { flex: 1; min-height: 0; position: relative; }
.caso-cargando { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #94a3b8; border-radius: 16px; background: #0b1220; }
.caso-pastillas { max-width: 100%; flex-wrap: wrap; display: flex; gap: 3px; padding: 3px; border-radius: 12px; background: rgba(15, 23, 42, .85); border: 1px solid #334155; }
.caso-pastillas button {
    padding: 3px 8px; border-radius: 9px; border: 1px solid transparent; background: none; cursor: pointer;
    white-space: nowrap; font-size: 10px; font-weight: 600; color: #94a3b8;
}
.caso-pastillas button.activa { color: #5eead4; background: rgba(45, 212, 191, .15); border-color: rgba(45, 212, 191, .4); }
.caso-coord {
    margin-left: auto; padding: 4px 10px; border-radius: 999px; cursor: pointer; font: 600 11px/1.2 var(--font-mono);
    color: #fbbf24; background: rgba(15, 23, 42, .85); border: 1px solid rgba(251, 191, 36, .35);
}
.caso-coord.activa { background: rgba(251, 191, 36, .15); }

.caso-panel {
    min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;
    padding: 12px; border-radius: 16px; background: rgba(15, 23, 42, .88); border: 1px solid rgba(45, 212, 191, .2);
}
.caso-progreso { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.caso-puntitos { display: flex; gap: 5px; }
.caso-puntitos button { width: 8px; height: 8px; padding: 0; border: 0; border-radius: 99px; cursor: pointer; background: #334155; transition: width .2s; }
.caso-puntitos button.hecho { background: #818cf8; }
.caso-puntitos button.actual { width: 18px; background: #2dd4bf; }
.caso-titulo { margin: 2px 0 0; font-size: 15px; color: #fff; }
.caso-pregunta { margin: 0; font-size: 13px; font-weight: 600; color: #5eead4; line-height: 1.4; }
.caso-desc { margin: 0; font-size: 11.5px; color: #94a3b8; line-height: 1.45; }
.caso-opciones { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; }
.caso-opcion {
    display: flex; align-items: center; gap: 10px; padding: 8px 10px; text-align: left; cursor: pointer;
    border-radius: 14px; background: rgba(30, 41, 59, .75); border: 1px solid rgba(255, 255, 255, .08);
    color: inherit; font: inherit; transition: transform .18s cubic-bezier(.34, 1.56, .64, 1), border-color .15s, box-shadow .15s;
}
.caso-opcion:not(:disabled):hover, .caso-opcion:focus-visible {
    transform: translateY(-2px); border-color: #2dd4bf; box-shadow: 0 8px 22px -6px rgba(45, 212, 191, .3); outline: none;
}
.caso-opcion:disabled { cursor: not-allowed; }
.caso-opcion.elegida { border-color: #818cf8; background: rgba(99, 102, 241, .16); }
.caso-radio { width: 14px; height: 14px; flex: none; border-radius: 99px; border: 2px solid rgba(45, 212, 191, .7); }
.caso-opcion.elegida .caso-radio { background: #818cf8; border-color: #818cf8; box-shadow: inset 0 0 0 2px #1e293b; }
.caso-opcion-texto { flex: 1; display: flex; flex-direction: column; gap: 2px; }
.caso-opcion-texto strong { font-size: 12.5px; color: #fff; }
.caso-opcion-texto small { font-size: 11px; color: #cbd5e1; line-height: 1.35; }
.caso-colocados { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin-top: auto; padding-top: 8px; font-size: 11px; color: #94a3b8; }
.caso-colocados em { font-style: normal; padding: 2px 7px; border-radius: 7px; color: #c7d2fe; background: rgba(99, 102, 241, .16); border: 1px solid rgba(129, 140, 248, .3); }

/* ── Procesando ── */
.caso-procesando { margin: auto; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; }
.caso-procesando h3 { margin: 0; font-size: 17px; color: #fff; }
.caso-procesando p { margin: 0; font-size: 12.5px; color: #94a3b8; }
.caso-pulso { width: 54px; height: 54px; border-radius: 99px; background: radial-gradient(circle, #5eead4, #0d9488); animation: caso-latido 1s ease-in-out infinite; }
@keyframes caso-latido { 50% { transform: scale(1.18); box-shadow: 0 0 30px rgba(45, 212, 191, .6); } }
.caso-barra { width: 220px; height: 6px; border-radius: 99px; background: #1e293b; overflow: hidden; }
.caso-barra div { height: 100%; width: 0; background: linear-gradient(90deg, #2dd4bf, #818cf8); animation: caso-llenar 1.2s ease-out forwards; }
@keyframes caso-llenar { to { width: 100%; } }

/* ── Resultado ── */
.caso-resultado { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; }
.caso-resultado-arriba { display: flex; gap: 14px; align-items: stretch; flex-wrap: wrap; }
.caso-video { width: min(240px, 100%); aspect-ratio: 1; object-fit: cover; border-radius: 18px; background: #020617; flex: none; }
.caso-resultado-texto { flex: 1 1 260px; display: flex; flex-direction: column; gap: 8px; }
.caso-resultado-texto h2 { margin: 0; font-size: clamp(18px, 2.4vw, 24px); color: #fff; }
.caso-resultado-texto p { margin: 0; font-size: 13px; line-height: 1.5; color: #cbd5e1; }
.caso-etiqueta { align-self: flex-start; padding: 5px 12px; border-radius: 999px; font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
.tono-bien .caso-etiqueta { color: #6ee7b7; background: rgba(16, 185, 129, .18); border: 1px solid rgba(16, 185, 129, .4); }
.tono-medio .caso-etiqueta { color: #fcd34d; background: rgba(245, 158, 11, .18); border: 1px solid rgba(245, 158, 11, .4); }
.tono-mal .caso-etiqueta { color: #fda4af; background: rgba(244, 63, 94, .16); border: 1px solid rgba(244, 63, 94, .4); }
.caso-cifras { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; margin-top: auto; }
.caso-cifras div { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 12px; background: rgba(15, 23, 42, .85); border: 1px solid #1e293b; }
.caso-cifras small { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8; }
.caso-cifras strong { font-size: 15px; color: #fff; }
.caso-repaso { display: flex; flex-direction: column; gap: 5px; padding: 12px; border-radius: 14px; background: rgba(15, 23, 42, .85); border: 1px solid #1e293b; }
.caso-repaso h3 { margin: 0 0 3px; font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; }
.caso-repaso-fila { display: flex; gap: 9px; align-items: baseline; font-size: 12.5px; color: #cbd5e1; line-height: 1.4; }
.caso-repaso-fila strong { color: #e2e8f0; }
.caso-repaso-fila em { color: #fcd34d; font-style: normal; }
.caso-repaso-n { flex: none; width: 19px; height: 19px; border-radius: 99px; display: inline-flex; align-items: center; justify-content: center; font-size: 10.5px; font-weight: 700; }
.caso-repaso-fila.bien .caso-repaso-n { color: #052e16; background: #34d399; }
.caso-repaso-fila.mal .caso-repaso-n { color: #4c0519; background: #fda4af; }

@media (prefers-reduced-motion: reduce) {
    .caso-pulso, .caso-barra div { animation: none; }
    .caso-barra div { width: 100%; }
}
`
