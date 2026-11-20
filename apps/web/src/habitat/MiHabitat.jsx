/**
 * Hábitat — la casa de cada persona + tienda con Supernovas (19 nov 2026,
 * migraciones 027 y 028). Primera versión.
 *
 *   · Dos pestañas: "Mi casa" (la casa + sus sellos) y "Tienda".
 *   · Sus primeros objetos son los SELLOS que le dio la profe en clase: van
 *     en repisas en la pared (GET /users/me/sellos).
 *   · Supernovas: 100 por cada taller comprado, 50 por cada persona
 *     invitada (los números vienen de la API, `reglas`).
 *   · Tienda: muebles, plantas, decoración, mascotas y estilos (paredes y
 *     piso). Al comprar algo se pone solo; luego se puede quitar o cambiar.
 *   · Precios y validación viven en la API (`habitatCatalogo.js`); aquí solo
 *     se dibuja (`Casa.jsx`, `muebles.jsx`).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sparkle, ShoppingBag, SealCheck, ArrowCounterClockwise, Question, X, ClockCounterClockwise } from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import { esOscuro } from '@utils/tema.js'
import Casa, { Miniatura, SELLOS_EN_CASA } from './Casa.jsx'
import { selloPorId } from '@/aula/catalogo.js'
import JuegoHabitat, { tituloDeJuego } from './JuegoHabitat.jsx'

const CATEGORIAS = [
  { id: 'todo',     nombre: 'Todo' },
  { id: 'muebles',  nombre: 'Muebles',    lugares: ['cama', 'sofa', 'escritorio', 'librero', 'mesa', 'lampara', 'puff'] },
  { id: 'plantas',  nombre: 'Plantas',    lugares: ['planta_rincon', 'planta_frente', 'repisa'] },
  { id: 'deco',     nombre: 'Decoración', lugares: ['alfombra', 'cuadro_der', 'cuadro_izq', 'cortinas'] },
  { id: 'mascotas', nombre: 'Mascotas',   lugares: ['mascota'] },
  { id: 'estilos',  nombre: 'Paredes y piso', lugares: ['pared', 'piso'] },
  { id: 'mio',      nombre: 'Lo mío' },
]
const FIJOS = new Set(['pared', 'piso'])   // siempre hay uno: se cambia, no se quita

const MOTIVO = { taller: 'Compraste un taller', referido: 'Invitaste a alguien', compra: 'Compraste', estrellas: 'Tus Estrellas ahora son Supernovas', ajuste: 'Ajuste' }

export default function MiHabitat() {
  const token = useAuthStore(s => s.token)
  const [datos, setDatos]       = useState(null)
  const [error, setError]       = useState(null)
  const [cat, setCat]           = useState('todo')
  const [elegido, setElegido]   = useState(null)   // lugar tocado en la casa
  const [confirmar, setConfirmar] = useState(null) // id a punto de comprarse
  const [ocupado, setOcupado]   = useState(null)
  const [aviso, setAviso]       = useState(null)
  const [verComo, setVerComo]   = useState(false)
  const [verHist, setVerHist]   = useState(false)
  const [pestana, setPestana]   = useState('casa')  // casa | tienda
  const [sellos, setSellos]     = useState([])
  const [selloSel, setSelloSel] = useState(null)
  const [jugando, setJugando]   = useState(null)   // fila de sello con juego abierta
  const noche = esOscuro()

  const api = useCallback(async (ruta = '', opts = {}) => {
    const r = await fetch(`/api/users/me/habitat${ruta}`, {
      ...opts, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
    const d = await r.json().catch(() => null)
    if (!r.ok) throw new Error(d?.message ?? 'Algo salió mal, intenta de nuevo')
    return d
  }, [token])

  useEffect(() => {
    if (!token) return
    api().then(setDatos).catch(e => setError(e.message))
    fetch('/api/users/me/sellos', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null)).then(d => setSellos(d?.sellos ?? [])).catch(() => {})
  }, [api, token])

  // Un sello por tipo en la casa (con cuántas veces lo ganó y en qué talleres).
  const misSellos = useMemo(() => {
    const por = new Map()
    for (const s of sellos) {
      const g = por.get(s.sello) ?? { sello: s.sello, veces: 0, talleres: [], primero: s.created_at, juegos: [] }
      g.veces++; if (s.taller_nombre && !g.talleres.includes(s.taller_nombre)) g.talleres.push(s.taller_nombre)
      // Cada actividad distinta que abre este sello (la más reciente gana).
      if (s.juego) { g.juegos = g.juegos.filter(x => x.juego.id !== s.juego.id); g.juegos.push(s) }
      por.set(s.sello, g)
    }
    return [...por.values()]
  }, [sellos])

  /** Tocar un sello: si abre una sola actividad, se juega directo. */
  const tocarSello = (id) => {
    setElegido(null); setPestana('casa')
    const g = misSellos.find(x => x.sello === id)
    if (g?.juegos.length === 1) { setSelloSel(id); setJugando(g.juegos[0]); return }
    setSelloSel(prev => (prev === id ? null : id))
  }

  const nombres = useMemo(() => Object.fromEntries((datos?.catalogo ?? []).map(o => [o.id, o.nombre])), [datos])

  const lista = useMemo(() => {
    if (!datos) return []
    const propios = new Set(datos.propios)
    const c = CATEGORIAS.find(x => x.id === cat)
    return datos.catalogo
      .filter(o => cat === 'mio' ? propios.has(o.id) : !c.lugares || c.lugares.includes(o.lugar))
      .filter(o => !elegido || o.lugar === elegido)
      .sort((a, b) => (propios.has(a.id) - propios.has(b.id)) || a.precio - b.precio)
  }, [datos, cat, elegido])

  const avisar = (txt, ok = true) => { setAviso({ txt, ok }); setTimeout(() => setAviso(a => (a?.txt === txt ? null : a)), 3500) }

  const comprar = async (o) => {
    setOcupado(o.id); setConfirmar(null)
    try { setDatos(await api('/comprar', { method: 'POST', body: JSON.stringify({ objetoId: o.id }) })); avisar(`¡${o.nombre} ya está en tu casa! ✦`) }
    catch (e) { avisar(e.message, false) }
    finally { setOcupado(null) }
  }

  const acomodar = async (puestos, txt) => {
    const antes = datos
    setDatos(d => ({ ...d, puestos }))            // se ve al instante
    try { setDatos(await api('', { method: 'PUT', body: JSON.stringify({ puestos }) })); if (txt) avisar(txt) }
    catch (e) { setDatos(antes); avisar(e.message, false) }
  }
  const poner  = (o) => acomodar({ ...datos.puestos, [o.lugar]: o.id })
  const quitar = (lugar) => { const p = { ...datos.puestos }; delete p[lugar]; setElegido(null); acomodar(p, 'Lo guardaste en "Lo mío"') }

  if (error) return <p className="hb-error">{error}</p>
  if (!datos) return <div className="hb-cargando" aria-busy="true">Abriendo tu casa…</div>

  const propios = new Set(datos.propios)
  const elegidoId = elegido ? datos.puestos[elegido] : null

  return (
    <div className="hb">
      <style>{CSS}</style>

      <div className="hb-barra">
        <span className="hb-saldo" aria-live="polite"><Sparkle size={18} weight="fill" /> {datos.saldo} <small>Supernovas</small></span>
        <button type="button" className="hb-chip" onClick={() => setVerComo(v => !v)} aria-expanded={verComo}>
          <Question size={15} /> ¿Cómo gano más?
        </button>
        <button type="button" className="hb-chip" onClick={() => setVerHist(v => !v)} aria-expanded={verHist}>
          <ClockCounterClockwise size={15} /> Historial
        </button>
      </div>
      {verComo && (
        <div className="hb-info">
          <p><strong>✦ {datos.reglas.porTaller}</strong> por cada taller que compras.</p>
          <p><strong>✦ {datos.reglas.porReferido}</strong> por cada persona que invitas y paga su taller.</p>
          {datos.reglas.porReto && <p><strong>✦ {datos.reglas.porReto}</strong> por superar el reto de tiempo de cada actividad de tus sellos (una vez por actividad).</p>}
          <p className="hb-mute">Úsalas para decorar tu casa: muebles, plantas, mascotas y colores.</p>
        </div>
      )}
      {verHist && (
        <ul className="hb-info hb-hist">
          {datos.movimientos.length === 0 && <li className="hb-mute">Todavía no tienes movimientos.</li>}
          {datos.movimientos.map((m, i) => (
            <li key={i}>
              <span>{MOTIVO[m.motivo] ?? m.motivo}{m.detalle && m.motivo !== 'estrellas' ? ` · ${m.detalle}` : ''}</span>
              <strong className={m.cantidad > 0 ? 'mas' : 'menos'}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</strong>
            </li>
          ))}
        </ul>
      )}

      <div className={`hb-marco${noche ? ' hb-noche' : ''}`}>
        <Casa puestos={datos.puestos} noche={noche} nombres={nombres} elegido={elegido}
          onElegir={l => { setSelloSel(null); setPestana('tienda'); setElegido(prev => (prev === l ? null : l)) }}
          sellos={misSellos} selloElegido={selloSel}
          onElegirSello={tocarSello} />
        {aviso && <div className={`hb-aviso${aviso.ok ? '' : ' hb-aviso--mal'}`} role="status">{aviso.txt}</div>}
      </div>

      <div className="hb-pestanas" role="tablist">
        <button role="tab" aria-selected={pestana === 'casa'} className={pestana === 'casa' ? 'on' : ''}
          onClick={() => { setPestana('casa'); setElegido(null) }}>Mi casa</button>
        <button role="tab" aria-selected={pestana === 'tienda'} className={pestana === 'tienda' ? 'on' : ''}
          onClick={() => setPestana('tienda')}><ShoppingBag size={16} /> Tienda</button>
      </div>

      {jugando && (
        <JuegoHabitat sello={jugando} token={token}
          onSaldo={saldo => setDatos(d => (d ? { ...d, saldo } : d))}
          onCerrar={() => {
            setJugando(null)
            fetch('/api/users/me/sellos', { headers: { Authorization: `Bearer ${token}` } })
              .then(r => (r.ok ? r.json() : null)).then(d => d && setSellos(d.sellos ?? [])).catch(() => {})
          }} />
      )}

      {pestana === 'casa' && (
        <section className="hb-sellos" aria-label="Mis sellos">
          <h2><SealCheck size={20} weight="fill" /> Mis sellos</h2>
          {misSellos.length === 0 ? (
            <p className="hb-mute">Cuando tu profe te dé un sello en clase, aparecerá aquí y en una repisa de tu casa ✦</p>
          ) : (
            <div className="hb-sellos-lista">
              {misSellos.map(g => {
                const def = selloPorId(g.sello)
                return (
                  <button key={g.sello} type="button" className={`hb-sello${selloSel === g.sello ? ' on' : ''}`}
                    style={{ '--c': def?.color ?? '#D97706' }} onClick={() => tocarSello(g.sello)}>
                    {def?.imagen ? <img src={def.imagen} alt="" /> : <span className="hb-sello-emoji">{def?.emoji ?? '✦'}</span>}
                    <strong>{def?.nombre ?? g.sello}{g.veces > 1 ? ` ×${g.veces}` : ''}</strong>
                    {g.juegos.length > 0 && <span className="hb-sello-tag">▶ {g.juegos.length === 1 ? 'Jugar' : `${g.juegos.length} actividades`}</span>}
                    {selloSel === g.sello && (
                      <span className="hb-mute">{def?.mensaje ? `${def.mensaje}. ` : ''}{g.talleres.length ? `En ${g.talleres.join(', ')}` : ''}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
          {(() => {
            const g = misSellos.find(x => x.sello === selloSel)
            if (!g || g.juegos.length < 2) return null
            return (
              <div className="hb-juegos" aria-label="Actividades de este sello">
                {g.juegos.map(s => (
                  <button key={s.id} type="button" className="hb-juego" onClick={() => setJugando(s)}>
                    ▶ {tituloDeJuego(s.juego)}
                    {s.juego.reto && !s.juego.reto.ganado && <small> · reto {s.juego.reto.segundos} s</small>}
                    {!s.juego.disponible && <small> · 🔒</small>}
                  </button>
                ))}
              </div>
            )
          })()}
          {misSellos.length > SELLOS_EN_CASA && <p className="hb-mute">En tu casa se ven tus primeros {SELLOS_EN_CASA} sellos.</p>}
          <p className="hb-pista">¿Quieres decorar? Entra a la <button type="button" className="hb-link-in" onClick={() => setPestana('tienda')}>Tienda</button> con tus Supernovas.</p>
        </section>
      )}

      {pestana === 'tienda' && elegido && (
        <div className="hb-elegido">
          <span><strong>{nombres[elegidoId] ?? 'Este lugar'}</strong> · abajo ves lo que puedes poner aquí</span>
          <span className="hb-elegido-acc">
            {!FIJOS.has(elegido) && <button type="button" onClick={() => quitar(elegido)}><ArrowCounterClockwise size={14} /> Quitar</button>}
            <button type="button" onClick={() => setElegido(null)} aria-label="Ver toda la tienda"><X size={14} /> Ver todo</button>
          </span>
        </div>
      )}

      {pestana === 'tienda' && (
      <section className="hb-tienda" aria-label="Tienda">
        <div className="hb-cats" role="tablist">
          {CATEGORIAS.map(c => (
            <button key={c.id} role="tab" aria-selected={cat === c.id} className={cat === c.id ? 'on' : ''}
              onClick={() => { setCat(c.id); setElegido(null) }}>{c.nombre}</button>
          ))}
        </div>
        <div className="hb-grid">
          {lista.map(o => {
            const mio = propios.has(o.id), puesto = datos.puestos[o.lugar] === o.id
            const falta = o.precio - datos.saldo
            return (
              <div key={o.id} className={`hb-item${puesto ? ' hb-item--puesto' : ''}`}>
                <Miniatura id={o.id} lugar={o.lugar} />
                <strong>{o.nombre}</strong>
                <span className="hb-mute">{datos.lugares[o.lugar]}</span>
                {mio ? (
                  puesto
                    ? (FIJOS.has(o.lugar)
                        ? <span className="hb-estado">✓ En uso</span>
                        : <button type="button" className="hb-btn hb-btn--sec" onClick={() => quitar(o.lugar)}>✓ Puesto · Quitar</button>)
                    : <button type="button" className="hb-btn hb-btn--sec" onClick={() => poner(o)}>Poner</button>
                ) : confirmar === o.id ? (
                  <span className="hb-confirmar">
                    <button type="button" className="hb-btn" onClick={() => comprar(o)}>Sí, comprar</button>
                    <button type="button" className="hb-link" onClick={() => setConfirmar(null)}>No</button>
                  </span>
                ) : (
                  <button type="button" className="hb-btn" disabled={falta > 0 || ocupado === o.id}
                    onClick={() => setConfirmar(o.id)} title={falta > 0 ? `Te faltan ${falta} Supernovas` : undefined}>
                    ✦ {o.precio}{falta > 0 ? <small> · faltan {falta}</small> : ''}
                  </button>
                )}
              </div>
            )
          })}
          {lista.length === 0 && <p className="hb-mute">Aquí aparecerá lo que compres.</p>}
        </div>
      </section>
      )}
    </div>
  )
}

const CSS = `
.hb { display: flex; flex-direction: column; gap: var(--space-4); }
.hb-cargando, .hb-error { padding: var(--space-12, 48px); text-align: center; color: var(--text-muted); }
.hb-error { color: var(--color-error); }
.hb-mute { color: var(--text-muted); font-size: var(--text-xs); }
.hb-barra { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.hb-saldo { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: var(--radius-full);
  background: linear-gradient(135deg, #D97706, #f2a65a); color: #fff; font-weight: 800; font-size: var(--text-lg, 18px);
  box-shadow: 0 6px 18px rgba(217,119,6,.3); margin-right: auto; }
.hb-saldo small { font-size: var(--text-xs); font-weight: 700; opacity: .9; }
.hb-chip { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: var(--radius-full);
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-secondary);
  font-family: var(--font-sans); font-size: var(--text-xs); cursor: pointer; }
.hb-info { margin: 0; padding: var(--space-3) var(--space-4); border-radius: var(--radius-lg); background: var(--bg-surface);
  border: 1px solid var(--border-subtle); font-size: var(--text-sm); color: var(--text-secondary); }
.hb-info p { margin: 2px 0; }
.hb-info strong { color: var(--color-amber-500); }
.hb-hist { list-style: none; display: flex; flex-direction: column; gap: 6px; max-height: 220px; overflow: auto; }
.hb-hist li { display: flex; justify-content: space-between; gap: 12px; }
.hb-hist .mas { color: var(--color-jade-500); } .hb-hist .menos { color: var(--text-muted); }

.hb-marco { position: relative; border-radius: var(--radius-xl, 20px); overflow: hidden; border: 1px solid var(--border-subtle);
  background: radial-gradient(ellipse at 50% 35%, #e9f6f2 0%, #cde9f0 55%, #b9dde9 100%); box-shadow: 0 10px 30px rgba(0,0,0,.12); }
.hb-marco.hb-noche { background: radial-gradient(ellipse at 50% 35%, #1b3d52 0%, #0f2638 60%, #061A18 100%); }
.hb-casa { display: block; width: 100%; max-width: 760px; margin: 0 auto; height: auto; user-select: none; }
.hb-mueble { cursor: pointer; outline: none; transition: filter .2s ease; }
.hb-mueble:hover, .hb-mueble:focus-visible { filter: brightness(1.08) drop-shadow(0 0 6px rgba(255,255,255,.9)); }
.hb-mueble--on { filter: drop-shadow(0 0 5px #fbbf24) drop-shadow(0 0 2px #fbbf24); }
.hb-aviso { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); padding: 8px 16px; border-radius: var(--radius-full);
  background: rgba(6,26,24,.85); color: #FAF7F2; font-size: var(--text-sm); font-weight: 600; white-space: nowrap; max-width: calc(100% - 24px); overflow: hidden; text-overflow: ellipsis; }
.hb-aviso--mal { background: #b91c1c; }

.hb-elegido { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 14px;
  border-radius: var(--radius-lg); background: color-mix(in srgb, #fbbf24 16%, var(--bg-surface)); border: 1px solid #fbbf24; font-size: var(--text-sm); }
.hb-elegido-acc { display: flex; gap: 6px; }
.hb-elegido button { display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: var(--radius-full);
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-xs); cursor: pointer; }

.hb-pestanas { display: flex; gap: 4px; padding: 4px; border-radius: var(--radius-full); background: var(--bg-surface);
  border: 1px solid var(--border-subtle); width: fit-content; }
.hb-pestanas button { display: inline-flex; align-items: center; gap: 6px; padding: 8px 18px; border-radius: var(--radius-full); border: none;
  background: transparent; color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 600; cursor: pointer; }
.hb-pestanas button.on { background: var(--color-jade-500); color: #fff; }
.hb-sellos h2 { display: flex; align-items: center; gap: 8px; margin: 0 0 var(--space-3); font-size: var(--text-xl); }
.hb-sellos h2 svg { color: var(--color-amber-500); }
.hb-sellos-lista { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: var(--space-3); }
.hb-sello { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: var(--space-3); border-radius: var(--radius-lg);
  background: var(--bg-surface); border: 2px solid transparent; cursor: pointer; font-family: var(--font-sans); color: var(--text-primary); text-align: center; }
.hb-sello.on { border-color: var(--c); }
.hb-sello-tag { font-size: var(--text-xs); font-weight: 700; color: #fff; background: #D97706; border-radius: 999px; padding: 2px 8px; }
.hb-juegos { display: flex; flex-wrap: wrap; gap: var(--space-2); margin-top: var(--space-3); }
.hb-juego { border: 0; cursor: pointer; border-radius: 999px; padding: 8px 14px; background: #0D7377; color: #fff; font-family: var(--font-sans); font-weight: 600; }
.hb-juego small { font-weight: 400; opacity: .85; }
.hb-sello img, .hb-sello-emoji { width: 56px; height: 56px; object-fit: contain; border-radius: 50%; background: color-mix(in srgb, var(--c) 14%, transparent);
  border: 2px solid var(--c); display: grid; place-items: center; font-size: 28px; }
.hb-sello strong { font-size: var(--text-xs); }
.hb-pista { margin: var(--space-3) 0 0; font-size: var(--text-xs); color: var(--text-muted); }
.hb-link-in { background: none; border: none; padding: 0; color: var(--color-jade-500); font-weight: 700; cursor: pointer; font-family: var(--font-sans); font-size: inherit; }
.hb-tienda h2 { display: flex; align-items: center; gap: 8px; margin: var(--space-2) 0 var(--space-3); font-size: var(--text-xl); }
.hb-cats { display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px; margin-bottom: var(--space-3); }
.hb-cats button { flex-shrink: 0; padding: 6px 14px; border-radius: var(--radius-full); border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); cursor: pointer; }
.hb-cats button.on { border-color: var(--color-jade-500); background: color-mix(in srgb, var(--color-jade-500) 14%, transparent); color: var(--color-jade-500); font-weight: 700; }
.hb-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: var(--space-3); }
.hb-item { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; padding: var(--space-3);
  border-radius: var(--radius-lg); background: var(--bg-surface); border: 1px solid var(--border-subtle); }
.hb-item--puesto { border-color: var(--color-jade-500); box-shadow: inset 0 0 0 1px var(--color-jade-500); }
.hb-item strong { font-size: var(--text-sm); }
.hb-mini { width: 100%; max-width: 120px; aspect-ratio: 1; border-radius: var(--radius-md); background: color-mix(in srgb, #cde9f0 45%, transparent); }
.hb-btn { margin-top: 6px; width: 100%; padding: 7px 10px; border-radius: var(--radius-full); border: none; cursor: pointer;
  background: var(--color-amber-500, #D97706); color: #fff; font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 800; }
.hb-btn small { font-weight: 600; opacity: .9; }
.hb-btn:disabled { background: var(--border-default); color: var(--text-muted); cursor: not-allowed; }
.hb-btn--sec { background: transparent; border: 1px solid var(--color-jade-500); color: var(--color-jade-500); }
.hb-estado { margin-top: 6px; font-size: var(--text-xs); font-weight: 700; color: var(--color-jade-500); padding: 7px 0; }
.hb-confirmar { display: flex; flex-direction: column; align-items: center; width: 100%; }
.hb-link { background: none; border: none; color: var(--text-muted); font-size: var(--text-xs); cursor: pointer; margin-top: 4px; font-family: var(--font-sans); }
@media (prefers-reduced-motion: reduce) { .hb-mueble { transition: none; } }
`
