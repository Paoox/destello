/**
 * Destello — Jugar la actividad de un sello en el Hábitat (migración 029).
 *
 * Un sello que la profe puso con una actividad abierta "se lleva" esa
 * actividad. Aquí se vuelve a jugar con el MISMO componente del aula (el
 * registro de actividades es genérico: solo recibe contenido y estado).
 *
 * Reto: si la termina en el tiempo límite gana Supernovas, una sola vez por
 * actividad. El reloj que cuenta es el del servidor (POST jugar → POST
 * terminar); el de pantalla es solo para que la persona se vea. Arranca
 * cuando de verdad empieza a jugar (ver `yaEmpezo`), no mientras lee las
 * instrucciones o hace el tutorial.
 *
 * El material hoy sale de los materiales de ensayo; cuando exista el
 * material real de cada taller, solo cambia `materialPorId`.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Timer, ArrowCounterClockwise, Sparkle, LockSimple } from '@phosphor-icons/react'
import { tipoDe, resumenDe } from '@/aula/actividades/registro.js'
import { ESTADO_INICIAL } from '@/aula/actividades/contrato.js'
import { MATERIALES_DE_ENSAYO } from '@/pages/materialesDeEnsayo.js'

export const materialPorId = (id) => MATERIALES_DE_ENSAYO.find(m => m.id === id) ?? null
export const tituloDeJuego = (juego) => {
  const m = materialPorId(juego?.id)
  return m?.contenido?.titulo ?? m?.nombre ?? tipoDe(m)?.nombre ?? 'Actividad'
}

/**
 * ¿Ya empezó a jugar? Cada actividad marca el arranque a su manera: la sopa y
 * el crucigrama arman `tablero`, el memorama y la trivia barajan `orden`. Las
 * que no tienen instrucciones (quiz) arrancan con la primera respuesta.
 */
export const yaEmpezo = (e) =>
  !!e?.tablero || (Array.isArray(e?.orden) && e.orden.length > 0) ||
  (!e?.fase && !e?.tuto && Object.keys(e?.pasos ?? {}).length > 0)

export default function JuegoHabitat({ sello, token, onCerrar, onSaldo }) {
  const juego = sello.juego
  const material = materialPorId(juego.id)
  const Actividad = tipoDe(material)?.Componente ?? null

  const [partida, setPartida] = useState(null)     // { juegoId, reto, inicio }
  // Si ya la jugó antes (tiene mejor tiempo), no se le repite el tutorial.
  const [estado, setEstado]   = useState(juego.mejorTiempo != null ? { ...ESTADO_INICIAL, tutorialHecho: true } : ESTADO_INICIAL)
  const [ronda, setRonda]     = useState(0)
  const [ahora, setAhora]     = useState(Date.now())
  const [fin, setFin]         = useState(null)      // respuesta del servidor
  const [error, setError]     = useState(null)
  const terminando = useRef(false)
  const iniciando  = useRef(false)

  /** Pide al servidor que arranque el reloj del reto. */
  const arrancar = useCallback(async () => {
    if (iniciando.current) return
    iniciando.current = true
    try {
      const r = await fetch(`/api/users/me/sellos/${sello.id}/jugar`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo abrir la actividad')
      setPartida({ juegoId: d.juegoId, reto: d.reto, inicio: Date.now() })
    } catch (e) { setError(e.message); iniciando.current = false }
  }, [sello.id, token])

  /** Otra partida: de vuelta al inicio, sin repetir el tutorial. */
  const otraVez = () => {
    setError(null); setFin(null); setPartida(null)
    setEstado({ ...ESTADO_INICIAL, tutorialHecho: true })
    terminando.current = false; iniciando.current = false
    setRonda(n => n + 1)
  }

  // Reloj de pantalla (solo mientras se juega)
  useEffect(() => {
    if (!partida || fin) return
    const t = setInterval(() => setAhora(Date.now()), 250)
    return () => clearInterval(t)
  }, [partida, fin])

  // Esc cierra
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onCerrar()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onCerrar])

  const alCambiar = async (nuevo) => {
    setEstado(nuevo)
    if (!partida && yaEmpezo(nuevo)) arrancar()
    if (!partida || terminando.current || !resumenDe(material, nuevo).terminado) return
    terminando.current = true
    try {
      const r = await fetch(`/api/users/me/habitat/juegos/${partida.juegoId}/terminar`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` },
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.message ?? 'No se pudo guardar tu tiempo')
      setFin(d)
      if (d.ganadas) onSaldo?.(d.saldo)
    } catch (e) { setError(e.message) }
  }

  const seg = partida ? Math.floor(((fin ? partida.inicio + fin.segundos * 1000 : ahora) - partida.inicio) / 1000) : 0
  const reto = partida?.reto ?? juego.reto
  const enReto = reto && !reto.ganado
  const pasado = enReto && seg > reto.segundos

  return (
    <div className="hj-fondo" role="dialog" aria-modal="true" aria-label={tituloDeJuego(juego)}>
      <div className="hj-caja">
        <header className="hj-cab">
          <div>
            <small>Actividad de tu sello · {sello.taller_nombre ?? 'Destello'}</small>
            <h2>{tituloDeJuego(juego)}</h2>
          </div>
          {!fin && juego.disponible && material && (
            <span className={`hj-reloj${pasado ? ' hj-reloj--fuera' : ''}${partida ? '' : ' hj-reloj--espera'}`}>
              <Timer size={16} weight="bold" /> {partida ? `${seg} s${enReto ? ` / ${reto.segundos} s` : ''}` : 'Empieza cuando quieras'}
            </span>
          )}
          <button type="button" className="hj-cerrar" onClick={onCerrar} aria-label="Cerrar"><X size={20} weight="bold" /></button>
        </header>

        {enReto && !fin && juego.disponible && material && (
          <p className="hj-reto"><Sparkle size={15} weight="fill" /> Reto: termínala en menos de <strong>{reto.segundos} s</strong> y gana <strong>{reto.supernovas} Supernovas</strong> (una sola vez). El reloj arranca cuando empiezas a jugar.</p>
        )}

        {fin && (
          <div className={`hj-fin${fin.ganadas ? ' hj-fin--gano' : ''}`}>
            {fin.ganadas
              ? <p>🎉 ¡Reto superado en <strong>{fin.segundos} s</strong>! Ganaste <strong>{fin.ganadas} Supernovas</strong> ✦</p>
              : fin.yaGanado || !fin.limite
                ? <p>✨ ¡Terminaste en <strong>{fin.segundos} s</strong>!</p>
                : <p>Terminaste en <strong>{fin.segundos} s</strong>. El reto es en {fin.limite} s, ¡tú puedes! 💪</p>}
            <button type="button" className="hj-btn" onClick={otraVez}><ArrowCounterClockwise size={16} weight="bold" /> Jugar otra vez</button>
          </div>
        )}

        <div className="hj-zona">
          {!juego.disponible ? (
            <div className="hj-aviso"><LockSimple size={28} />
              <p>{juego.motivo === 'premium'
                ? 'Este contenido es de la membresía de Destello, que llega muy pronto ✦'
                : 'El material extra de este taller ya cerró (estuvo abierto 30 días).'}</p></div>
          ) : !material || !Actividad ? (
            <div className="hj-aviso"><p>Esta actividad todavía no está lista. ¡Pronto podrás jugarla aquí! ✦</p></div>
          ) : error ? (
            <div className="hj-aviso"><p>{error}</p><button type="button" className="hj-btn" onClick={otraVez}>Intentar otra vez</button></div>
          ) : (
            <Actividad key={ronda} contenido={material.contenido} estado={estado}
              onCambio={alCambiar} liberado={!fin} esProfe={false} />
          )}
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  )
}

const CSS = `
.hj-fondo { position: fixed; inset: 0; z-index: 60; background: rgba(6, 26, 24, .72); display: grid; place-items: center; padding: 16px; }
.hj-caja { width: min(980px, 100%); max-height: calc(100dvh - 32px); overflow: auto; background: var(--bg-card, #FAF7F2);
  color: var(--text-primary, #1f2937); border-radius: 20px; box-shadow: 0 20px 60px rgba(0,0,0,.35); display: flex; flex-direction: column; }
.hj-cab { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-bottom: 1px solid rgba(13,115,119,.15); position: sticky; top: 0; background: inherit; z-index: 1; }
.hj-cab > div { flex: 1; min-width: 0; }
.hj-cab small { color: #0D7377; font-weight: 600; font-size: 12px; }
.hj-cab h2 { margin: 0; font-size: 18px; font-family: 'Space Grotesk', sans-serif; }
.hj-reloj { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-variant-numeric: tabular-nums;
  background: #0D7377; color: #fff; border-radius: 999px; padding: 4px 10px; font-size: 14px; }
.hj-reloj--fuera { background: #9ca3af; }
.hj-reloj--espera { background: rgba(13,115,119,.12); color: #0D7377; font-weight: 600; }
.hj-cerrar { border: 0; background: transparent; color: inherit; cursor: pointer; padding: 6px; border-radius: 10px; }
.hj-cerrar:hover { background: rgba(13,115,119,.1); }
.hj-reto { margin: 10px 16px 0; padding: 8px 12px; border-radius: 12px; background: rgba(217,119,6,.12); color: #92400e; font-size: 14px; display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.hj-fin { margin: 10px 16px 0; padding: 10px 14px; border-radius: 12px; background: rgba(13,115,119,.1); display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
.hj-fin p { margin: 0; }
.hj-fin--gano { background: rgba(217,119,6,.16); }
.hj-zona { padding: 14px 16px 18px; min-height: 320px; }
.hj-aviso { min-height: 300px; display: grid; place-items: center; text-align: center; gap: 10px; color: #4b5563; align-content: center; }
.hj-btn { display: inline-flex; align-items: center; gap: 6px; border: 0; cursor: pointer; border-radius: 999px; padding: 8px 14px;
  background: #0D7377; color: #fff; font-weight: 600; font-family: inherit; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .hj-reto { color: #fcd34d; } :root:not([data-theme="light"]) .hj-aviso { color: #cbd5e1; } }
:root[data-theme="dark"] .hj-reto { color: #fcd34d; }
:root[data-theme="dark"] .hj-aviso { color: #cbd5e1; }
`
