/**
 * Destello — Actividad: Trivia (con el búho)
 *
 * Basada en "Desafío de conocimiento" de Paola (`mini-juegos/desafio_conocimiento`),
 * vuelta genérica: las preguntas llegan en `contenido`.
 *
 * ¿En qué se diferencia del Quiz? El Quiz es la evaluación seria: no dice si
 * vas bien hasta el final. La trivia es el juego: cada respuesta te dice al
 * momento si atinaste y por qué, con el búho de guía, y al final tu puntaje.
 *
 * ── Forma del contenido ──────────────────────────────────────────────────
 *
 *   {
 *     titulo: 'Cultura general',
 *     instrucciones: '…',                  // opcional
 *     segundosPorPregunta: 0,              // opcional; 0 = sin reloj (default)
 *     barajar: true,                       // opcional: orden de preguntas y opciones al azar (default true)
 *     preguntas: [{
 *       id: 'oceano', categoria: 'Geografía',
 *       pregunta: '¿Cuál es el océano más grande…?',
 *       opciones: [{ texto: 'Pacífico', correcta: true }, { texto: 'Atlántico' }, …],   // 2 a 4
 *       explicacion: 'El Pacífico abarca…',  // opcional
 *     }],
 *   }
 *
 * ── Estado ───────────────────────────────────────────────────────────────
 *
 *   { orden: ['oceano', …], opciones: { oceano: [2, 0, 1] },   // el barajado, para que no cambie al volver
 *     pasos: { oceano: 0 },     // índice ORIGINAL de la opción elegida; -1 = se acabó el tiempo
 *     actual: 3, tutorialHecho, ultimoCambio }
 *
 * El reloj es opcional y viene apagado: si se prende y se acaba, la pregunta
 * cuenta como no respondida, se ve la explicación y se sigue — nunca hay
 * pantalla de "perdiste".
 */
import { useEffect, useRef, useState } from 'react'
import { marcarCambio } from './contrato.js'
import { barajar, useAltoDelPizarron } from './comun.js'

import logo from './trivia/logo.webp'
import buhoAtento from './trivia/buho-atento.webp'
import buhoCelebrando from './trivia/buho-celebrando.webp'
import buhoConcentrado from './trivia/buho-concentrado.webp'
import buhoDiploma from './trivia/buho-diploma.webp'
import buhoFeliz from './trivia/buho-feliz.webp'
import buhoPensando from './trivia/buho-pensando.webp'
import buhoSonriendo from './trivia/buho-sonriendo.webp'
import letraA from './trivia/a.webp'
import letraB from './trivia/b.webp'
import letraC from './trivia/c.webp'
import paloma from './trivia/paloma.webp'
import tache from './trivia/tache.webp'
import reloj from './trivia/reloj.webp'
import foco from './trivia/foco.webp'
import listaIcono from './trivia/lista.webp'
import copa from './trivia/copa.webp'

const LETRAS = [letraA, letraB, letraC]
const LETRA_TEXTO = ['A', 'B', 'C', 'D']

const TUTORIAL = {
    id: 'tutorial', categoria: 'Práctica',
    pregunta: '¿De qué color es el cielo durante un día completamente despejado?',
    opciones: [{ texto: 'Rojo' }, { texto: 'Azul', correcta: true }, { texto: 'Verde' }],
    explicacion: '¡Así se juega! Eliges una opción y el búho te dice al momento si atinaste y por qué.',
}

const idDe = (p, i) => p.id ?? `p${i + 1}`
const correctaDe = (p) => p.opciones.findIndex(o => o.correcta)

/** El búho y la frase según qué tan bien le fue (en proporción, no en puntos fijos). */
function veredicto(aciertos, total) {
    const r = total ? aciertos / total : 0
    if (r === 1) return { buho: buhoCelebrando, titulo: '¡Perfecto!', texto: 'Respondiste todo bien. ¡Eres una experta!' }
    if (r >= 0.8) return { buho: buhoDiploma, titulo: '¡Excelente!', texto: 'Casi perfecto: dominas el tema.' }
    if (r >= 0.6) return { buho: buhoSonriendo, titulo: '¡Muy bien!', texto: 'Vas por buen camino; repasa las que se te fueron.' }
    return { buho: buhoAtento, titulo: '¡Buen intento!', texto: 'Cada pregunta es una oportunidad de aprender. Repasa las explicaciones.' }
}

/** Resumen para la miniatura de la profe. */
export function resumen(contenido, estado) {
    const preguntas = contenido?.preguntas ?? []
    if (!preguntas.length) return { avance: 0, etiqueta: 'sin preguntas', terminado: false }
    if (!estado?.orden) return { avance: 0, etiqueta: 'sin empezar', terminado: false }
    const respondidas = preguntas.filter((p, i) => estado?.pasos?.[idDe(p, i)] !== undefined)
    const aciertos = preguntas.filter((p, i) => estado?.pasos?.[idDe(p, i)] === correctaDe(p)).length
    const terminado = respondidas.length >= preguntas.length
    return {
        avance:    Math.round((respondidas.length / preguntas.length) * 100),
        etiqueta:  terminado ? `${aciertos}/${preguntas.length} aciertos` : `${respondidas.length} de ${preguntas.length}`,
        terminado,
    }
}

/* ══════════════════════════════════════════════════════════════════════════
   La actividad
   ══════════════════════════════════════════════════════════════════════════ */

export default function Trivia({ contenido, estado, onCambio, liberado, esProfe }) {
    const raiz = useRef(null)
    const alto = useAltoDelPizarron(raiz)
    const [fase, setFase] = useState('instrucciones')

    const preguntas = (contenido?.preguntas ?? []).filter(p => p?.opciones?.length >= 2)
    const porId = Object.fromEntries(preguntas.map((p, i) => [idDe(p, i), p]))
    const segundos = Math.max(0, Math.round(contenido?.segundosPorPregunta ?? 0))
    const toque = () => onCambio(marcarCambio(estado, {}))

    if (!preguntas.length) {
        return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Esta trivia todavía no tiene preguntas.</p>
    }

    const empezar = (extra = {}) => {
        if (!liberado) return
        const mezclar = contenido?.barajar ?? true
        const ids = preguntas.map(idDe)
        const orden = mezclar ? barajar(ids) : ids
        const opciones = Object.fromEntries(preguntas.map((p, i) => {
            const idx = p.opciones.map((_, j) => j)
            return [idDe(p, i), mezclar ? barajar(idx) : idx]
        }))
        onCambio(marcarCambio(estado, { orden, opciones, pasos: {}, actual: 0, ...extra }))
    }

    const orden = (estado?.orden ?? []).filter(id => porId[id])
    const empezado = orden.length > 0
    const actual = estado?.actual ?? 0
    const pasos = estado?.pasos ?? {}
    const aciertos = orden.filter(id => pasos[id] === correctaDe(porId[id])).length
    const puedeSaltar = esProfe || estado?.tutorialHecho

    let pantalla
    if (empezado && actual >= orden.length) {
        pantalla = <Resultados orden={orden} porId={porId} pasos={pasos} aciertos={aciertos} liberado={liberado} onOtraVez={() => empezar()} />
    } else if (empezado) {
        const id = orden[actual]
        pantalla = (
            <Pregunta
                key={id}
                pregunta={porId[id]}
                ordenOpciones={estado?.opciones?.[id]}
                elegida={pasos[id]}
                numero={actual + 1}
                total={orden.length}
                aciertos={aciertos}
                segundos={segundos}
                liberado={liberado}
                esProfe={esProfe}
                onResponder={(j) => onCambio(marcarCambio(estado, { pasos: { ...pasos, [id]: j } }))}
                onSiguiente={() => onCambio(marcarCambio(estado, { actual: actual + 1 }))}
            />
        )
    } else if (fase === 'tutorial') {
        pantalla = (
            <TutorialTrivia
                liberado={liberado}
                puedeSaltar={puedeSaltar}
                onToque={toque}
                onTerminar={() => empezar({ tutorialHecho: true })}
                onVolver={() => setFase('instrucciones')}
            />
        )
    } else {
        pantalla = (
            <div className="tri-tarjeta tri-centro">
                <img className="tri-logo" src={logo} alt="Trivia" />
                {contenido?.titulo && (
                    <span className="tri-categoria"><img src={buhoConcentrado} alt="" /> {contenido.titulo}</span>
                )}
                <p className="tri-intro">
                    {contenido?.instrucciones ?? 'Responde cada pregunta y descubre cuánto sabes. El búho te explica cada respuesta.'}
                </p>
                <div className="tri-reglas">
                    <div><img src={listaIcono} alt="" /><span><strong>{preguntas.length} preguntas</strong> con {Math.max(...preguntas.map(p => p.opciones.length))} opciones cada una.</span></div>
                    <div><img src={reloj} alt="" /><span>{segundos ? <><strong>{segundos} segundos</strong> por pregunta. Si se acaba, ves la respuesta y sigues.</> : <><strong>Sin reloj:</strong> piensa con calma.</>}</span></div>
                    <div><img src={foco} alt="" /><span>Después de cada respuesta, el búho te explica la correcta.</span></div>
                </div>
                <div className="tri-acciones">
                    <button className="tri-boton" onClick={() => { setFase('tutorial'); toque() }} disabled={!liberado}>¿Cómo jugar?</button>
                    {puedeSaltar && <button className="tri-boton tri-boton-sutil" onClick={() => empezar()} disabled={!liberado}>Ya sé jugar</button>}
                </div>
            </div>
        )
    }

    return (
        <div ref={raiz} className="tri" style={{ height: alto ?? undefined, opacity: liberado ? 1 : 0.55 }}>
            <style>{CSS}</style>
            <div className="tri-scroll">{pantalla}</div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Una pregunta (la usan el juego y el tutorial)
   ══════════════════════════════════════════════════════════════════════════ */

function Pregunta({ pregunta, ordenOpciones, elegida, numero, total, aciertos, segundos, liberado, esProfe, practica, onResponder, onSiguiente, textoSiguiente }) {
    const orden = ordenOpciones?.length === pregunta.opciones.length ? ordenOpciones : pregunta.opciones.map((_, j) => j)
    const correcta = correctaDe(pregunta)
    const respondida = elegida !== undefined
    const [quedan, setQuedan] = useState(segundos)

    useEffect(() => {
        if (!segundos || respondida || !liberado) return
        if (quedan <= 0) { onResponder(-1); return }
        const t = setTimeout(() => setQuedan(s => s - 1), 1000)
        return () => clearTimeout(t)
    }, [quedan, segundos, respondida, liberado])  // eslint-disable-line react-hooks/exhaustive-deps

    const atino = elegida === correcta
    const buho = !respondida ? buhoConcentrado : atino ? buhoFeliz : buhoPensando

    return (
        <div className="tri-tarjeta">
            <div className="tri-barra">
                <span className="tri-categoria"><img src={buhoConcentrado} alt="" /> {pregunta.categoria ?? 'Pregunta'}</span>
                {!practica && <span className="tri-progreso">Pregunta {numero} de {total}</span>}
                {!practica && <span className="tri-puntos"><img src={copa} alt="" /> {aciertos}</span>}
            </div>
            {!practica && (
                <div className="tri-avance"><span style={{ width: `${((numero - (respondida ? 0 : 1)) / total) * 100}%` }} /></div>
            )}
            {segundos > 0 && !respondida && (
                <div className={`tri-reloj ${quedan <= 5 ? 'tri-reloj-poco' : ''}`}>
                    <img src={reloj} alt="" /> {quedan} s
                    <span className="tri-reloj-barra"><span style={{ width: `${(quedan / segundos) * 100}%` }} /></span>
                </div>
            )}

            <div className="tri-pregunta">
                <img className="tri-buho" src={buho} alt="" />
                <h3>{pregunta.pregunta}</h3>
            </div>

            <div className="tri-opciones">
                {orden.map((j, pos) => {
                    const o = pregunta.opciones[j]
                    const clase = !respondida ? '' : j === correcta ? 'tri-bien' : j === elegida ? 'tri-mal' : 'tri-apagada'
                    return (
                        <button
                            key={j}
                            className={`tri-opcion ${clase} ${esProfe && !respondida && j === correcta ? 'tri-pista-profe' : ''}`}
                            onClick={() => !respondida && liberado && onResponder(j)}
                            disabled={!liberado || respondida}
                        >
                            {LETRAS[pos]
                                ? <img className="tri-letra" src={LETRAS[pos]} alt={LETRA_TEXTO[pos]} />
                                : <span className="tri-letra tri-letra-texto">{LETRA_TEXTO[pos]}</span>}
                            <span className="tri-opcion-texto">{o.texto}</span>
                            {respondida && j === correcta && <img className="tri-marca" src={paloma} alt="Correcta" />}
                            {respondida && j === elegida && j !== correcta && <img className="tri-marca" src={tache} alt="Incorrecta" />}
                        </button>
                    )
                })}
            </div>

            {respondida && (
                <div className={`tri-explicacion ${atino ? 'tri-explicacion-bien' : ''}`}>
                    <img src={foco} alt="" />
                    <p>
                        <strong>{elegida === -1 ? '¡Se acabó el tiempo! ' : atino ? '¡Correcto! ' : `La respuesta era: ${pregunta.opciones[correcta]?.texto}. `}</strong>
                        {pregunta.explicacion}
                    </p>
                    <button className="tri-boton" onClick={onSiguiente} disabled={!liberado}>
                        {textoSiguiente ?? (numero >= total ? 'Ver resultados' : 'Siguiente')}
                    </button>
                </div>
            )}
        </div>
    )
}

function TutorialTrivia({ liberado, puedeSaltar, onToque, onTerminar, onVolver }) {
    const [elegida, setElegida] = useState(undefined)
    return (
        <div className="tri-tuto">
            <div className="tri-tuto-cabeza">
                <img src={buhoAtento} alt="" />
                <p><strong>Práctica:</strong> toca la respuesta que creas correcta. Esta no cuenta.</p>
            </div>
            <Pregunta
                key={elegida === undefined ? 'nueva' : 'hecha'}
                pregunta={TUTORIAL}
                elegida={elegida}
                segundos={0}
                liberado={liberado}
                practica
                onResponder={(j) => { setElegida(j); onToque() }}
                onSiguiente={onTerminar}
                textoSiguiente="¡Entendido, a jugar!"
            />
            <div className="tri-acciones">
                {elegida !== undefined && <button className="tri-boton tri-boton-sutil" onClick={() => setElegida(undefined)}>Otra vez</button>}
                {elegida === undefined && puedeSaltar && <button className="tri-boton tri-boton-sutil" onClick={onTerminar} disabled={!liberado}>Saltar práctica</button>}
                <button className="tri-boton tri-boton-sutil" onClick={onVolver}>Ver reglas</button>
            </div>
        </div>
    )
}

/* ══════════════════════════════════════════════════════════════════════════
   Resultados
   ══════════════════════════════════════════════════════════════════════════ */

function Resultados({ orden, porId, pasos, aciertos, liberado, onOtraVez }) {
    const v = veredicto(aciertos, orden.length)
    return (
        <div className="tri-tarjeta tri-centro">
            <img className="tri-buho-grande" src={v.buho} alt="" />
            <h2 className="tri-titulo">{v.titulo}</h2>
            <div className="tri-marcador"><img src={copa} alt="" /> {aciertos} <span>/ {orden.length}</span></div>
            <p className="tri-intro">{v.texto}</p>
            <details className="tri-repaso">
                <summary><img src={listaIcono} alt="" /> Repasar mis respuestas</summary>
                <ol>
                    {orden.map(id => {
                        const p = porId[id]
                        const bien = pasos[id] === correctaDe(p)
                        return (
                            <li key={id}>
                                <img src={bien ? paloma : tache} alt={bien ? 'Bien' : 'Mal'} />
                                <span>
                                    <strong>{p.pregunta}</strong><br />
                                    Respuesta: {p.opciones[correctaDe(p)]?.texto}
                                </span>
                            </li>
                        )
                    })}
                </ol>
            </details>
            <button className="tri-boton" onClick={onOtraVez} disabled={!liberado}>Jugar otra vez</button>
        </div>
    )
}

/* ── Estilos ────────────────────────────────────────────────────────────────
   Del original: noche índigo → violeta, tarjeta de vidrio pizarra, opciones
   con letra ilustrada y verde/rosa al responder. Siempre oscuro. Prefijo `tri-`. */
const CSS = `
.tri {
    width: 100%; box-sizing: border-box; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column;
    font-family: 'Outfit', var(--font-sans); color: #fff;
    background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #311042 100%);
}
.tri-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; }
.tri-tarjeta {
    width: 100%; max-width: 720px; margin: auto; box-sizing: border-box;
    display: flex; flex-direction: column; gap: 12px; padding: clamp(14px, 2.5vw, 24px); border-radius: 22px;
    background: rgba(30, 41, 59, .88); border: 1px solid rgba(255, 255, 255, .1); box-shadow: 0 24px 60px -24px rgba(0, 0, 0, .7);
}
.tri-centro { align-items: center; text-align: center; }
.tri-logo { width: min(300px, 75%); height: auto; filter: drop-shadow(0 0 18px rgba(251, 191, 36, .35)); }
.tri-intro { margin: 0; max-width: 54ch; font-size: 14.5px; line-height: 1.5; color: #cbd5e1; }
.tri-reglas { width: 100%; max-width: 480px; display: flex; flex-direction: column; gap: 8px; text-align: left; }
.tri-reglas > div { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 14px; background: rgba(15, 23, 42, .6); font-size: 13.5px; line-height: 1.35; }
.tri-reglas img { width: 28px; height: 28px; object-fit: contain; flex: 0 0 auto; }
.tri-acciones { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.tri-boton {
    font: 800 15px/1 'Outfit', var(--font-sans); padding: 12px 22px; border-radius: 16px; border: 0; cursor: pointer; color: #fff;
    background: linear-gradient(90deg, #8b5cf6, #ec4899); box-shadow: 0 8px 22px -8px rgba(236, 72, 153, .8); transition: transform .15s;
}
.tri-boton:hover:not(:disabled) { transform: translateY(-1px); }
.tri-boton:disabled { cursor: not-allowed; filter: grayscale(.7); opacity: .55; }
.tri-boton-sutil { padding: 7px 14px; font-size: 12.5px; font-weight: 600; background: rgba(99, 102, 241, .18); border: 1px solid rgba(99, 102, 241, .45); box-shadow: none; }

.tri-barra { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.tri-categoria {
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 700;
    background: rgba(99, 102, 241, .25); border: 1px solid rgba(129, 140, 248, .45); color: #c7d2fe;
}
.tri-categoria img { width: 20px; height: 20px; object-fit: contain; }
.tri-progreso { margin-left: auto; font-size: 13px; color: #94a3b8; font-weight: 600; }
.tri-puntos { display: inline-flex; align-items: center; gap: 4px; font-weight: 800; color: #fde047; }
.tri-puntos img { width: 22px; height: 22px; object-fit: contain; }
.tri-avance { height: 6px; border-radius: 99px; background: rgba(15, 23, 42, .7); overflow: hidden; }
.tri-avance span { display: block; height: 100%; background: linear-gradient(90deg, #00EEEE, #8b5cf6, #ec4899); transition: width .4s; }
.tri-reloj { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #a5f3fc; }
.tri-reloj img { width: 22px; height: 22px; }
.tri-reloj-barra { flex: 1; height: 6px; border-radius: 99px; background: rgba(15, 23, 42, .7); overflow: hidden; }
.tri-reloj-barra span { display: block; height: 100%; background: #22d3ee; transition: width 1s linear; }
.tri-reloj-poco { color: #fda4af; }
.tri-reloj-poco .tri-reloj-barra span { background: #f43f5e; }

.tri-pregunta { display: flex; align-items: center; gap: 14px; }
.tri-buho { width: clamp(54px, 9vw, 80px); height: auto; flex: 0 0 auto; animation: tri-flota 3s ease-in-out infinite; }
@keyframes tri-flota { 50% { transform: translateY(-4px); } }
.tri-pregunta h3 { color: #fff; font-family: 'Outfit', var(--font-sans); margin: 0; font-size: clamp(16px, 2.3vw, 21px); font-weight: 700; line-height: 1.35; }

.tri-opciones { display: flex; flex-direction: column; gap: 8px; }
.tri-opcion {
    display: flex; align-items: center; gap: 12px; width: 100%; padding: 9px 14px; border-radius: 16px; cursor: pointer; text-align: left;
    font: 600 15px/1.3 'Outfit', var(--font-sans); color: #f1f5f9;
    background: rgba(15, 23, 42, .6); border: 2px solid rgba(99, 102, 241, .35); transition: transform .15s, border-color .15s, background .15s, box-shadow .15s;
}
.tri-opcion:hover:not(:disabled) { border-color: #818cf8; background: rgba(99, 102, 241, .22); transform: translateX(3px); box-shadow: 0 0 18px -4px rgba(129, 140, 248, .8); }
.tri-opcion:disabled { cursor: default; }
.tri-letra { width: 34px; height: 34px; object-fit: contain; flex: 0 0 auto; }
.tri-letra-texto { display: grid; place-items: center; border-radius: 50%; background: #6366f1; font-weight: 800; }
.tri-opcion-texto { flex: 1; }
.tri-marca { width: 26px; height: 26px; object-fit: contain; }
.tri-bien { border-color: #10b981 !important; background: rgba(16, 185, 129, .2) !important; box-shadow: 0 0 20px -6px #10b981; }
.tri-mal { border-color: #f43f5e !important; background: rgba(244, 63, 94, .18) !important; animation: tri-temblor .35s; }
@keyframes tri-temblor { 25% { transform: translateX(5px); } 75% { transform: translateX(-5px); } }
.tri-apagada { opacity: .45; }
.tri-pista-profe { box-shadow: inset 0 0 0 1px rgba(16, 185, 129, .6); }

.tri-explicacion {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 10px 14px; border-radius: 16px;
    background: rgba(244, 63, 94, .12); border: 1px solid rgba(244, 63, 94, .4); animation: tri-entra .3s ease-out;
}
.tri-explicacion-bien { background: rgba(16, 185, 129, .12); border-color: rgba(16, 185, 129, .45); }
@keyframes tri-entra { from { opacity: 0; transform: translateY(6px); } }
.tri-explicacion img { width: 26px; height: auto; flex: 0 0 auto; }
.tri-explicacion p { flex: 1 1 240px; margin: 0; font-size: 13.5px; line-height: 1.45; color: #e2e8f0; }
.tri-explicacion .tri-boton { margin-left: auto; }

.tri-tuto { width: 100%; max-width: 720px; margin: auto; display: flex; flex-direction: column; gap: 10px; }
.tri-tuto-cabeza { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #e0e7ff; }
.tri-tuto-cabeza img { width: 40px; height: auto; }
.tri-tuto-cabeza p { margin: 0; }

.tri-buho-grande { width: clamp(90px, 16vw, 140px); height: auto; animation: tri-flota 3s ease-in-out infinite; }
.tri-titulo { margin: 0; font-size: clamp(24px, 4vw, 32px); font-weight: 800; background: linear-gradient(90deg, #FFD700, #FF1493, #7B68EE); -webkit-background-clip: text; background-clip: text; color: transparent; }
.tri-marcador { display: flex; align-items: center; gap: 8px; font-size: 40px; font-weight: 800; color: #fde047; }
.tri-marcador img { width: 44px; height: 44px; object-fit: contain; }
.tri-marcador span { font-size: 22px; color: #94a3b8; }
.tri-repaso { width: 100%; max-width: 560px; text-align: left; border-radius: 14px; background: rgba(15, 23, 42, .55); padding: 8px 12px; }
.tri-repaso summary { cursor: pointer; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #c7d2fe; }
.tri-repaso summary img { width: 22px; height: 22px; object-fit: contain; }
.tri-repaso ol { margin: 8px 0 2px; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.tri-repaso li { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; line-height: 1.4; color: #cbd5e1; }
.tri-repaso li img { width: 18px; height: 18px; object-fit: contain; margin-top: 2px; }
.tri-repaso strong { color: #f1f5f9; font-weight: 600; }

@media (prefers-reduced-motion: reduce) { .tri-buho, .tri-buho-grande, .tri-mal, .tri-explicacion { animation: none; } }
`
