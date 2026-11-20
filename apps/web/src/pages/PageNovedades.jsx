/**
 * PageNovedades — descubrir Destello (19 nov 2026, pedido de Paola).
 *
 *   1. Próximos talleres: los 3 que empiezan antes; "Nuevo" si
 *      el taller se creó en los últimos 30 días.
 *   2. Explora por marca: una tarjeta por submarca (`categoria` del taller,
 *      presentación en `utils/submarcas.js`) + "Todos los talleres". Cada una
 *      abre /novedades/talleres(?marca=…) — `PageTalleresMarca.jsx`.
 *   3. Conoce a tus profes: fichas que llena Paola en el panel → Profesores
 *      (GET /tallers/profes, sin correo ni WhatsApp).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkle, X, Briefcase, GraduationCap, ChalkboardTeacher } from '@phosphor-icons/react'
import { apiListTalleres, apiListProfes } from '@services/publicApi.js'
import { TallerCard, ModalChispa } from '@components/talleres/Catalogo.jsx'
import { submarcaDe, marcasDe } from '@utils/submarcas.js'

const DIAS_NUEVO = 30

// 'YYYY-MM-DD' como fecha local (con new Date() directo se corre un día en CDMX).
function fechaCorta(v) {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v))
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

const iniciales = (n) => String(n ?? '').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase()

/** Foto cuadrada que llena su contenedor; sin foto, iniciales sobre degradado. */
function FotoProfe({ profe }) {
  return profe.foto
    ? <img src={profe.foto} alt={`Foto de ${profe.nombre}`} className="nv-foto" loading="lazy" />
    : <div className="nv-foto nv-foto--ini" aria-hidden="true"><span>{iniciales(profe.nombre)}</span></div>
}

const textoAnios = (n) => `${n} ${n === 1 ? 'año' : 'años'} de experiencia`
const marcasDeProfe = (p) => [...new Set(p.talleres.map(t => submarcaDe(t.categoria).id))]

function FichaProfe({ profe, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    ref.current?.focus()
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div className="nv-velo" onClick={onClose}>
      <div className="nv-ficha" role="dialog" aria-modal="true" aria-label={`Ficha de ${profe.nombre}`}
        onClick={e => e.stopPropagation()} ref={ref} tabIndex={-1}>
        <button className="nv-cerrar" onClick={onClose} aria-label="Cerrar"><X size={18} /></button>
        <div className="nv-ficha-cab">
          <div className="nv-ficha-foto"><FotoProfe profe={profe} /></div>
          <div className="nv-ficha-datos">
            <div className="nv-profe-marcas">
              {marcasDeProfe(profe).map(id => <span key={id} style={{ '--m': submarcaDe(id).color }}>{id}</span>)}
            </div>
            <h3>{profe.nombre}</h3>
            {profe.especialidad && <p className="nv-esp">{profe.especialidad}</p>}
            {profe.aniosExperiencia != null && (
              <p className="nv-anios"><Briefcase size={14} weight="fill" /> {textoAnios(profe.aniosExperiencia)}</p>
            )}
          </div>
        </div>
        {profe.semblanza && <p className="nv-semblanza">{profe.semblanza}</p>}
        {profe.formacion?.length > 0 && (
          <>
            <h4><GraduationCap size={16} /> Formación</h4>
            <ul className="nv-lista">{profe.formacion.map((f, i) => <li key={i}>{f}</li>)}</ul>
          </>
        )}
        <h4><ChalkboardTeacher size={16} /> Imparte</h4>
        <ul className="nv-lista">
          {profe.talleres.map(t => (
            <li key={t.id}>
              <span className="nv-punto" style={{ background: submarcaDe(t.categoria).color }} />
              {t.nombre}{fechaCorta(t.fecha_inicio) ? <span className="nv-mute"> · {fechaCorta(t.fecha_inicio)}</span> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export default function PageNovedades() {
  const [talleres, setTalleres] = useState([])
  const [profes, setProfes]     = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(null)
  const [ficha, setFicha]       = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    apiListTalleres().then(d => setTalleres(d.tallers ?? [])).catch(e => setError(e.message)).finally(() => setCargando(false))
    apiListProfes().then(d => setProfes(d.profes ?? [])).catch(() => {})
  }, [])

  // Próximos por fecha (cada nueva fecha reutiliza el mismo taller, así que
  // "nuevo" no se puede saber por la fecha de anuncio). La etiqueta "Nuevo"
  // es solo para talleres creados en los últimos 30 días.
  const proximos = useMemo(() => {
    const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
    return talleres
      .filter(t => !t.agotado && t.fecha_inicio && String(t.fecha_inicio).slice(0, 10) >= hoy)
      .sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)))
      .slice(0, 3)
  }, [talleres])
  const esNuevo = (t) => Date.parse(t.created_at) >= Date.now() - DIAS_NUEVO * 864e5

  const marcas = useMemo(() => marcasDe(talleres), [talleres])
  const verMarca = (id) => navigate(id ? `/novedades/talleres?marca=${encodeURIComponent(id)}` : '/novedades/talleres')

  return (
    <div className="nv">
      <style>{CSS_NOVEDADES}</style>
      <header className="nv-cab">
        <h1>Novedades</h1>
        <p>Talleres nuevos, nuestras marcas y quién te va a acompañar</p>
      </header>

      {cargando && <div className="nv-cargando" aria-busy="true">Cargando…</div>}
      {error && <p className="nv-error">No se pudieron cargar los talleres. Intenta de nuevo más tarde.</p>}

      {!cargando && proximos.length > 0 && (
        <section>
          <h2><Sparkle size={18} weight="fill" /> Próximos talleres</h2>
          <div className="nv-grid">
            {proximos.map(t => (
              <div key={t.id} className="nv-nuevo">
                {esNuevo(t) && <span className="nv-badge">Nuevo</span>}
                <TallerCard taller={t} onQuieroChispa={setModal} />
              </div>
            ))}
          </div>
        </section>
      )}

      {marcas.length > 0 && (
        <section>
          <h2>Explora por marca</h2>
          <div className="nv-marcas">
            {marcas.map(m => (
              <button key={m.id} type="button" className="nv-marca" style={{ '--m': m.color }} onClick={() => verMarca(m.id)}>
                <span className="nv-marca-simbolo" aria-hidden="true">{m.simbolo}</span>
                <span className="nv-marca-nombre">{m.id}</span>
                <span className="nv-marca-lema">{m.lema}</span>
                {m.descripcion && <span className="nv-marca-desc">{m.descripcion}</span>}
                <span className="nv-marca-n">Ver sus {m.n} {m.n === 1 ? 'taller' : 'talleres'} →</span>
              </button>
            ))}
            <button type="button" className="nv-marca nv-marca--todos" style={{ '--m': '#D97706' }} onClick={() => verMarca(null)}>
              <span className="nv-marca-simbolo" aria-hidden="true">✦</span>
              <span className="nv-marca-nombre">Todos los talleres</span>
              <span className="nv-marca-lema">Todo lo que ofrece Destello</span>
              <span className="nv-marca-n">Ver los {talleres.length} talleres →</span>
            </button>
          </div>
        </section>
      )}
      {!cargando && !error && talleres.length === 0 && (
        <p className="nv-vacio">No hay talleres disponibles por el momento. ¡Vuelve pronto!</p>
      )}

      {profes.length > 0 && (
        <section>
          <h2>Conoce a tus profes</h2>
          <div className="nv-profes">
            {profes.map(p => (
              <button key={p.id} type="button" className="nv-profe" onClick={() => setFicha(p)} aria-label={`Ver ficha de ${p.nombre}`}>
                <div className="nv-profe-foto">
                  <FotoProfe profe={p} />
                  <span className="nv-profe-marcas nv-profe-marcas--sobre">
                    {marcasDeProfe(p).map(id => <span key={id} style={{ '--m': submarcaDe(id).color }}>{id}</span>)}
                  </span>
                  {p.aniosExperiencia != null && (
                    <span className="nv-profe-anios"><Briefcase size={12} weight="fill" /> {p.aniosExperiencia} {p.aniosExperiencia === 1 ? 'año' : 'años'}</span>
                  )}
                </div>
                <div className="nv-profe-cuerpo">
                  <strong className="nv-profe-nombre">{p.nombre}</strong>
                  <span className="nv-esp">{p.especialidad || 'Profesora Destello'}</span>
                  {p.semblanza && <span className="nv-profe-resumen">{p.semblanza}</span>}
                  <span className="nv-profe-pie">
                    <span>{p.talleres.length} {p.talleres.length === 1 ? 'taller' : 'talleres'}</span>
                    <span className="nv-ver">Conócela →</span>
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {modal && <ModalChispa taller={modal} onClose={() => setModal(null)} />}
      {ficha && <FichaProfe profe={ficha} onClose={() => setFicha(null)} />}
    </div>
  )
}

export const CSS_NOVEDADES = `
.nv { padding: var(--space-8); max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: var(--space-10, 40px); }
@media (max-width: 640px) { .nv { padding: var(--space-4); } }
.nv-cab h1 { font-size: var(--text-3xl); font-weight: 700; letter-spacing: -0.02em; margin: 0; }
.nv-cab p { color: var(--text-muted); margin: 4px 0 0; }
.nv h2 { display: flex; align-items: center; gap: 8px; font-size: var(--text-xl); margin: 0 0 var(--space-4); }
.nv h2 svg { color: var(--color-amber-500); }
.nv-cargando, .nv-vacio { text-align: center; padding: var(--space-12, 48px); color: var(--text-muted); }
.nv-error { color: var(--color-error); text-align: center; }
.nv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: var(--space-4); }
.nv-nuevo { position: relative; }
.nv-badge { position: absolute; z-index: 2; top: 10px; right: 10px; padding: 3px 10px; border-radius: var(--radius-full);
  background: var(--color-amber-500); color: #fff; font-size: 11px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; box-shadow: 0 2px 8px rgba(0,0,0,.2); }
.nv-ancla { scroll-margin-top: 80px; }

.nv-marcas { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-4); }
.nv-marca { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 6px; text-align: left; cursor: pointer;
  padding: var(--space-5, 20px); border-radius: var(--radius-xl, 20px); border: 2px solid transparent; color: #fff; font-family: var(--font-sans);
  background: linear-gradient(135deg, var(--m) 0%, color-mix(in srgb, var(--m) 55%, #061A18) 100%);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--m) 30%, transparent); transition: transform .2s ease; }
.nv-marca:hover { transform: translateY(-3px); }
.nv-marca.on { border-color: #fff; outline: 3px solid var(--m); }
.nv-marca-simbolo { position: absolute; right: 14px; top: 6px; font-size: 64px; opacity: .18; line-height: 1; }
.nv-marca-nombre { font-size: var(--text-2xl, 24px); font-weight: 800; letter-spacing: -0.02em; }
.nv-marca-lema { font-size: var(--text-sm); font-weight: 600; opacity: .9; }
.nv-marca-desc { font-size: var(--text-xs); line-height: 1.5; opacity: .85; }
.nv-marca-n { margin-top: 6px; font-size: var(--text-xs); font-weight: 700; }

.nv-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-4); }
.nv-chips button { padding: 6px 14px; border-radius: var(--radius-full); border: 1px solid var(--border-default); background: transparent;
  color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); cursor: pointer; }
.nv-chips button.on { --m: var(--color-jade-500); border-color: var(--m); color: var(--m); background: color-mix(in srgb, var(--m) 12%, transparent); font-weight: 700; }

.nv-profes { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: var(--space-5, 20px); }
.nv-profe { display: flex; flex-direction: column; padding: 0; overflow: hidden; text-align: left; cursor: pointer;
  border-radius: var(--radius-xl, 20px); background: var(--bg-surface); border: 1px solid var(--border-subtle);
  color: var(--text-primary); font-family: var(--font-sans);
  box-shadow: 0 4px 18px rgba(6,26,24,.08); transition: transform .25s ease, box-shadow .25s ease, border-color .25s; }
.nv-profe:hover, .nv-profe:focus-visible { transform: translateY(-4px); border-color: var(--color-jade-500);
  box-shadow: 0 14px 34px rgba(13,115,119,.22); outline: none; }
.nv-profe-foto { position: relative; aspect-ratio: 1 / 1; overflow: hidden; background: var(--bg-base); }
.nv-profe-foto::after { content: ''; position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, rgba(6,26,24,.35) 0%, transparent 28%, transparent 70%, rgba(6,26,24,.45) 100%); }
.nv-profe .nv-foto { transition: transform .5s ease; }
.nv-profe:hover .nv-foto { transform: scale(1.04); }
.nv-foto { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center 25%; }
.nv-foto--ini { display: grid; place-items: center; background: linear-gradient(135deg, #0D7377 0%, #0F766E 45%, #D97706 100%); }
.nv-foto--ini span { color: #FAF7F2; font-weight: 800; font-size: clamp(48px, 9vw, 84px); letter-spacing: .02em; opacity: .95; }
.nv-profe-marcas { display: flex; flex-wrap: wrap; gap: 4px; }
.nv-profe-marcas span { padding: 3px 9px; border-radius: var(--radius-full); font-size: 11px; font-weight: 700;
  color: var(--m); background: color-mix(in srgb, var(--m) 14%, transparent); }
.nv-profe-marcas--sobre { position: absolute; z-index: 1; top: 12px; left: 12px; right: 12px; }
.nv-profe-marcas--sobre span { color: #fff; background: color-mix(in srgb, var(--m) 88%, #000); box-shadow: 0 2px 8px rgba(0,0,0,.25); }
.nv-profe-anios { position: absolute; z-index: 1; right: 12px; bottom: 12px; display: inline-flex; align-items: center; gap: 5px;
  padding: 4px 10px; border-radius: var(--radius-full); background: rgba(250,247,242,.94); color: #92400E; font-size: 11px; font-weight: 800; }
.nv-profe-cuerpo { display: flex; flex-direction: column; gap: 4px; flex: 1; padding: var(--space-4) var(--space-4) var(--space-4); }
.nv-profe-nombre { font-size: var(--text-lg, 18px); font-weight: 700; letter-spacing: -0.01em; }
.nv-esp { font-size: var(--text-sm); color: var(--color-jade-500); font-weight: 600; }
.nv-profe-resumen { margin-top: 4px; font-size: var(--text-xs); line-height: 1.55; color: var(--text-secondary);
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.nv-profe-pie { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: var(--space-3);
  border-top: 1px solid var(--border-subtle); font-size: var(--text-xs); color: var(--text-muted); }
.nv-ver { font-size: var(--text-xs); font-weight: 700; color: var(--color-jade-500); }
.nv-mute { font-size: var(--text-xs); color: var(--text-muted); }

.nv-velo { position: fixed; inset: 0; z-index: 1000; background: rgba(6,26,24,.6); display: grid; place-items: center; padding: 16px; }
.nv-ficha { position: relative; width: min(680px, 100%); max-height: 90vh; overflow: auto; padding: var(--space-6, 24px);
  border-radius: var(--radius-xl, 20px); background: var(--bg-card, var(--bg-surface)); border: 1px solid var(--border-default); outline: none;
  box-shadow: 0 24px 60px rgba(0,0,0,.35); }
.nv-cerrar { position: absolute; top: 12px; right: 12px; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
  border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-muted); cursor: pointer; z-index: 2; }
.nv-ficha-cab { display: grid; grid-template-columns: 220px 1fr; gap: var(--space-5, 20px); align-items: end; margin-bottom: var(--space-5, 20px); }
.nv-ficha-foto { aspect-ratio: 1 / 1; border-radius: var(--radius-lg); overflow: hidden; box-shadow: 0 10px 28px rgba(6,26,24,.25); }
.nv-ficha-datos { display: flex; flex-direction: column; gap: 6px; padding-bottom: 4px; }
.nv-ficha-cab h3 { margin: 4px 0 0; font-size: var(--text-2xl, 24px); font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; }
.nv-ficha-cab .nv-esp { margin: 0; font-size: var(--text-base); }
.nv-anios { display: flex; align-items: center; gap: 6px; margin: 2px 0 0; font-size: var(--text-xs); color: var(--color-amber-500); font-weight: 600; }
.nv-semblanza { font-size: var(--text-sm); line-height: 1.65; color: var(--text-secondary); white-space: pre-wrap; margin: 0 0 var(--space-4); }
.nv-ficha h4 { display: flex; align-items: center; gap: 6px; margin: var(--space-4) 0 var(--space-2); font-size: var(--text-sm); color: var(--color-jade-500); }
.nv-lista { margin: 0; padding-left: 18px; font-size: var(--text-sm); line-height: 1.7; color: var(--text-secondary); }
.nv-lista li:has(.nv-punto) { list-style: none; margin-left: -18px; display: flex; align-items: center; gap: 8px; }
.nv-punto { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
@media (max-width: 560px) { .nv-ficha-cab { grid-template-columns: 1fr; } .nv-ficha-foto { max-width: 280px; } }
`
