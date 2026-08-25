/**
 * Destello — Actividad: Quiz
 *
 * La primera actividad construida sobre el contrato. Cumple las cinco
 * obligaciones y no sabe absolutamente nada del aula que la envuelve.
 *
 * ⚠️ Las preguntas NO están aquí: llegan en `contenido`, desde la plantilla del
 * taller. Este mismo archivo sirve para el quiz de auriculoterapia y para el de
 * IA generativa sin cambiar una línea. Ese es el punto entero de las plantillas.
 *
 * ── Por qué NO se califica al vuelo ──────────────────────────────────────
 *
 * Cuando alguien contesta, no le sale "correcto" o "incorrecto" en la cara. Se
 * marca la respuesta y se sigue. Al final se ve cómo le fue.
 *
 * En una clase en vivo, un tache inmediato delante de un grupo hace que la
 * persona deje de arriesgarse — y contestar sin miedo a equivocarse es
 * justamente donde se aprende. La profe sí ve el avance en su rejilla; el
 * grupo, no.
 */
import { useState } from 'react'
import { CheckCircle, Circle } from '@phosphor-icons/react'
import { marcarCambio } from './contrato.js'

/** Resumen para la miniatura de la profe, sin montar el quiz completo. */
export function resumen(contenido, estado) {
    const total = contenido?.preguntas?.length ?? 0
    const hechas = Object.keys(estado?.pasos ?? {}).length
    if (!total) return { avance: 0, etiqueta: 'sin preguntas', terminado: false }
    return {
        avance:    Math.round((hechas / total) * 100),
        etiqueta:  hechas === 0 ? 'sin empezar' : `${hechas} de ${total}`,
        terminado: hechas >= total,
    }
}

export default function Quiz({ contenido, estado, onCambio, liberado, esProfe }) {
    const preguntas = contenido?.preguntas ?? []
    const respuestas = estado?.pasos ?? {}
    const [indice, setIndice] = useState(0)

    if (!preguntas.length) {
        return <Vacio texto="Esta actividad todavía no tiene preguntas." />
    }

    const pregunta = preguntas[indice]
    const elegida  = respuestas[pregunta.id]
    const contestadas = Object.keys(respuestas).length
    const terminado = contestadas >= preguntas.length

    const responder = (opcionId) => {
        if (!liberado) return
        onCambio(marcarCambio(estado, {
            pasos: { ...respuestas, [pregunta.id]: opcionId },
        }))
        // Avanzar solo si queda siguiente. Que no salte al final y parezca que
        // se cerró: la persona quiere ver que terminó.
        if (indice < preguntas.length - 1) {
            setTimeout(() => setIndice(i => i + 1), 260)
        }
    }

    // Moverse entre preguntas TAMBIÉN es interactuar. Sin esto, alguien
    // releyendo el ejercicio se pinta de rojo aunque esté trabajando.
    const irA = (i) => {
        setIndice(i)
        onCambio(marcarCambio(estado, {}))
    }

    return (
        <div style={{
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
            width: '100%', maxWidth: 480, padding: 'var(--space-4)',
            opacity: liberado ? 1 : 0.55,
        }}>
            {/* Dónde voy — puntitos, no una barra: son pocas y se pueden tocar */}
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {preguntas.map((p, i) => {
                    const hecha = respuestas[p.id] !== undefined
                    return (
                        <button
                            key={p.id}
                            onClick={() => irA(i)}
                            title={`Pregunta ${i + 1}${hecha ? ' · contestada' : ''}`}
                            style={{
                                width: i === indice ? 22 : 9, height: 9,
                                borderRadius: 'var(--radius-full)', padding: 0,
                                background: hecha ? 'var(--color-jade-500)'
                                          : i === indice ? 'var(--color-jade-300)'
                                          : 'var(--border-default)',
                                border: 'none', cursor: 'pointer',
                                transition: 'width .18s, background .18s',
                            }}
                        />
                    )
                })}
                <span style={{
                    marginLeft: 'auto', fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)', fontFamily: 'var(--font-mono)',
                }}>
                    {contestadas}/{preguntas.length}
                </span>
            </div>

            <h3 style={{
                fontSize: 'var(--text-base)', fontWeight: 600,
                margin: 0, lineHeight: 1.4, textWrap: 'balance',
            }}>
                {pregunta.texto}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pregunta.opciones.map(o => {
                    const seleccionada = elegida === o.id
                    // Solo la profe ve cuál es la buena, y solo cuando revisa.
                    const revelar = esProfe && o.correcta
                    return (
                        <button
                            key={o.id}
                            onClick={() => responder(o.id)}
                            disabled={!liberado}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 9,
                                padding: '10px 13px', textAlign: 'left',
                                background: seleccionada ? 'rgba(13,115,119,0.14)'
                                          : revelar ? 'rgba(5,150,105,0.09)'
                                          : 'var(--bg-surface)',
                                border: `1px solid ${seleccionada ? 'var(--color-jade-500)'
                                                   : revelar ? 'var(--color-success)'
                                                   : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                                cursor: liberado ? 'pointer' : 'not-allowed',
                                transition: 'background .15s, border-color .15s',
                            }}
                        >
                            {seleccionada
                                ? <CheckCircle size={17} weight="fill" color="var(--color-jade-500)" />
                                : <Circle size={17} color="var(--border-strong)" />}
                            <span style={{ flex: 1 }}>{o.texto}</span>
                            {revelar && (
                                <span style={{ fontSize: 10, color: 'var(--color-success)' }}>
                                    correcta
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            {terminado && (
                <p style={{
                    margin: 0, padding: '9px 12px',
                    background: 'rgba(13,115,119,0.10)',
                    border: '1px solid var(--color-jade-500)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-xs)', color: 'var(--color-jade-400)',
                }}>
                    Ya contestaste todas. Puedes volver a cualquiera para cambiar tu respuesta.
                </p>
            )}
        </div>
    )
}

function Vacio({ texto }) {
    return (
        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>{texto}</p>
    )
}
