/**
 * Destello — Actividad "Modelo 3D": explorar un modelo libremente
 *
 * El modelo solito en el pizarrón, para girarlo y acercarlo; el giro tiene tope
 * igual que en el caso. Sin preguntas ni calificación. Si el contenido trae `puntos`, salen
 * como lista: al tocar uno se señala en el modelo y se lee su descripción.
 *
 * ── Forma del contenido ──────────────────────────────────────────────────
 *
 *   {
 *     titulo: 'La oreja en 3D',
 *     descripcion: 'Gírala y acércala…',                         // opcional
 *     modelo: { url: '/contenido/…/oreja.glb', rotacion, espejo,
 *               credito: { texto: 'Modelo: … · autor · CC BY 4.0', url } },  // si la licencia lo pide
 *     giroLibre: false,   // true = vuelta completa (por defecto no: la parte de atrás del modelo no luce)
 *     puntos: [{ id, nombre, descripcion, x, y }],              // opcional
 *   }
 *
 * `x`/`y` son el % del modelo visto de frente, igual que en el caso clínico
 * (ver `visor3d/Visor3D.jsx`).
 *
 * Estado: `{ pasos: { [idPunto]: true } }` — los puntos que ya revisó, para
 * que la profe vea en la miniatura quién está explorando.
 */
import { lazy, Suspense, useRef, useState } from 'react'
import { marcarCambio } from './contrato.js'
import { useAltoDelPizarron } from './comun.js'

// three.js solo se descarga cuando de verdad se abre un modelo.
const Visor3D = lazy(() => import('../visor3d/Visor3D.jsx'))

/** Resumen para la miniatura de la profe. */
export function resumen(contenido, estado) {
    const puntos = contenido?.puntos ?? []
    const vistos = puntos.filter(p => estado?.pasos?.[p.id]).length
    if (!puntos.length) {
        return { avance: estado?.ultimoCambio ? 100 : 0, etiqueta: estado?.ultimoCambio ? 'explorando' : 'sin abrir', terminado: false }
    }
    return {
        avance:    Math.round((vistos / puntos.length) * 100),
        etiqueta:  `${vistos} de ${puntos.length} puntos`,
        terminado: vistos >= puntos.length,
    }
}

export default function Modelo3D({ contenido, estado, onCambio, liberado }) {
    const raiz = useRef(null)
    const alto = useAltoDelPizarron(raiz)
    const ultimoAviso = useRef(0)
    const [elegido, setElegido] = useState(null)
    const [verTodos, setVerTodos] = useState(false)

    const puntos = contenido?.puntos ?? []
    const vistos = estado?.pasos ?? {}
    const actual = puntos.find(p => p.id === elegido) ?? null

    if (!contenido?.modelo?.url) {
        return <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>Este material todavía no tiene modelo 3D.</p>
    }

    // Girar el modelo ES interactuar (contrato), pero se avisa a lo mucho cada
    // 3 segundos para no inundar el canal con cada arrastre.
    const avisar = () => {
        const ahora = Date.now()
        if (ahora - ultimoAviso.current < 3000) return
        ultimoAviso.current = ahora
        onCambio(marcarCambio(estado, {}))
    }

    const elegir = (p) => {
        if (!liberado) return
        const nuevo = elegido === p.id ? null : p.id
        setElegido(nuevo)
        if (nuevo && !vistos[p.id]) onCambio(marcarCambio(estado, { pasos: { ...vistos, [p.id]: true } }))
    }

    const marcas = (verTodos ? puntos : actual ? [actual] : [])
        .map(p => ({ id: p.id, x: p.x, y: p.y, estilo: 'punto' }))

    return (
        <div ref={raiz} className="m3d" style={{ opacity: liberado ? 1 : 0.6, height: alto ?? undefined }}>
            <style>{CSS}</style>

            <div className="m3d-cabeza">
                <h2>{contenido.titulo ?? 'Modelo 3D'}</h2>
                {contenido.descripcion && <p>{contenido.descripcion}</p>}
            </div>

            <div className={`m3d-cuerpo${puntos.length ? '' : ' m3d-solo'}`}>
                <div className="m3d-visor">
                    <Suspense fallback={<div className="m3d-cargando">Preparando el modelo 3D…</div>}>
                        <Visor3D
                            url={contenido.modelo.url}
                            rotacion={contenido.modelo.rotacion}
                            espejo={contenido.modelo.espejo}
                            credito={contenido.modelo.credito}
                            giroLibre={contenido.giroLibre ?? false}
                            puntos={marcas}
                            objetivo={actual ? { x: actual.x, y: actual.y } : null}
                            bloqueado={!liberado}
                            onInteraccion={avisar}
                        />
                    </Suspense>
                </div>

                {puntos.length > 0 && (
                    <div className="m3d-panel">
                        <div className="m3d-panel-cabeza">
                            <span>Puntos de referencia</span>
                            <button className={verTodos ? 'activo' : ''} onClick={() => setVerTodos(v => !v)} disabled={!liberado}>
                                {verTodos ? 'Ocultar todos' : 'Ver todos'}
                            </button>
                        </div>
                        <div className="m3d-lista">
                            {puntos.map(p => (
                                <button key={p.id}
                                    className={`m3d-punto${p.id === elegido ? ' activo' : ''}${vistos[p.id] ? ' visto' : ''}`}
                                    onClick={() => elegir(p)} disabled={!liberado}>
                                    <strong>{p.nombre}</strong>
                                    {p.id === elegido && p.descripcion && <small>{p.descripcion}</small>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

const CSS = `
/* Oscuro siempre, como el caso: el modelo luce sobre fondo oscuro. */
.m3d {
    width: 100%; height: 100%; min-height: 0; box-sizing: border-box;
    padding: 12px 46px 12px 12px; /* 46px: la columna de botones del aula */
    display: flex; flex-direction: column; gap: 10px; font-family: var(--font-sans); color: #e2e8f0;
    background: linear-gradient(135deg, #070d18 0%, #0d1527 50%, #062b24 100%); border-radius: 14px;
}
.m3d-cabeza h2 { margin: 0; font-size: 16px; color: #fff; }
.m3d-cabeza p { margin: 3px 0 0; font-size: 12px; line-height: 1.45; color: #94a3b8; }
.m3d-cuerpo { flex: 1; min-height: 0; display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr) minmax(200px, 260px); }
.m3d-solo { grid-template-columns: minmax(0, 1fr); }
@media (max-width: 760px) {
    .m3d-cuerpo { grid-template-columns: 1fr; grid-template-rows: minmax(240px, 1fr) auto; }
    .m3d-lista { max-height: 150px; }
}
.m3d-visor { min-height: 0; position: relative; }
.m3d-cargando { height: 100%; display: flex; align-items: center; justify-content: center; font-size: 13px; color: #94a3b8; border-radius: 16px; background: #0b1220; }
.m3d-panel {
    min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px;
    border-radius: 16px; background: rgba(15, 23, 42, .88); border: 1px solid rgba(45, 212, 191, .2);
}
.m3d-panel-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.m3d-panel-cabeza span { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #5eead4; }
.m3d-panel-cabeza button {
    padding: 3px 9px; border-radius: 999px; cursor: pointer; font: 600 10.5px/1.3 var(--font-sans);
    color: #cbd5e1; background: none; border: 1px solid #334155;
}
.m3d-panel-cabeza button.activo { color: #5eead4; border-color: rgba(45, 212, 191, .5); background: rgba(45, 212, 191, .12); }
.m3d-lista { flex: 1; min-height: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
.m3d-punto {
    display: flex; flex-direction: column; gap: 3px; padding: 7px 10px; text-align: left; cursor: pointer;
    border-radius: 11px; color: inherit; font: inherit; background: rgba(30, 41, 59, .75); border: 1px solid rgba(255, 255, 255, .08);
}
.m3d-punto:not(:disabled):hover { border-color: #2dd4bf; }
.m3d-punto:disabled { cursor: not-allowed; }
.m3d-punto strong { font-size: 12px; color: #fff; }
.m3d-punto.visto strong::after { content: ' ✓'; color: #34d399; font-weight: 700; }
.m3d-punto.activo { border-color: #2dd4bf; background: rgba(45, 212, 191, .12); }
.m3d-punto small { font-size: 11px; line-height: 1.4; color: #cbd5e1; }
`
