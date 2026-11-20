/**
 * PageTalleresMarca — /novedades/talleres(?marca=Horizonte Zen)
 * (19 nov 2026, pedido de Paola).
 *
 * Se llega desde las tarjetas de "Explora por marca" en Novedades. Arriba la
 * presentación de la marca elegida (o "Todos los talleres"); los chips
 * cambian entre una marca y todos sin regresar. Abajo el catálogo con el mismo
 * modal "Quiero mi Chispa" de siempre.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { apiListTalleres } from '@services/publicApi.js'
import { TallerCard, ModalChispa } from '@components/talleres/Catalogo.jsx'
import { submarcaDe, marcasDe } from '@utils/submarcas.js'
import { CSS_NOVEDADES } from './PageNovedades.jsx'

export default function PageTalleresMarca() {
  const [params, setParams] = useSearchParams()
  const marca = params.get('marca')
  const [talleres, setTalleres] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)
  const [modal, setModal]       = useState(null)

  useEffect(() => {
    apiListTalleres().then(d => setTalleres(d.tallers ?? [])).catch(e => setError(e.message)).finally(() => setCargando(false))
  }, [])

  const marcas = useMemo(() => marcasDe(talleres), [talleres])
  const info = marca ? submarcaDe(marca) : null
  const lista = marca ? talleres.filter(t => submarcaDe(t.categoria).id === info.id) : talleres
  const elegir = (id) => setParams(id ? { marca: id } : {}, { replace: true })

  return (
    <div className="nv">
      <style>{CSS_NOVEDADES + CSS}</style>
      <Link to="/novedades" className="tm-volver"><ArrowLeft size={14} /> Novedades</Link>

      <header className="tm-banda" style={{ '--m': info?.color ?? '#D97706' }}>
        <span className="nv-marca-simbolo" aria-hidden="true">{info?.simbolo ?? '✦'}</span>
        <h1>{info ? info.id : 'Todos los talleres'}</h1>
        <p className="tm-lema">{info ? info.lema : 'Todo lo que ofrece Destello, de todas nuestras marcas'}</p>
        {info?.descripcion && <p className="tm-desc">{info.descripcion}</p>}
      </header>

      <section>
        <div className="nv-chips" role="group" aria-label="Filtrar por marca">
          <button className={!marca ? 'on' : ''} aria-pressed={!marca} onClick={() => elegir(null)}>Todos los talleres</button>
          {marcas.map(m => (
            <button key={m.id} className={info?.id === m.id ? 'on' : ''} aria-pressed={info?.id === m.id}
              style={{ '--m': m.color }} onClick={() => elegir(m.id)}>{m.id} · {m.n}</button>
          ))}
        </div>

        {cargando && <div className="nv-cargando" aria-busy="true">Cargando…</div>}
        {error && <p className="nv-error">No se pudieron cargar los talleres. Intenta de nuevo más tarde.</p>}
        {!cargando && !error && lista.length === 0 && (
          <p className="nv-vacio">{marca ? `Por ahora ${info.id} no tiene talleres abiertos. ¡Vuelve pronto!` : 'No hay talleres disponibles por el momento.'}</p>
        )}
        <div className="nv-grid">
          {lista.map(t => <TallerCard key={t.id} taller={t} onQuieroChispa={setModal} />)}
        </div>
      </section>

      {modal && <ModalChispa taller={modal} onClose={() => setModal(null)} />}
    </div>
  )
}

const CSS = `
.tm-volver { display: inline-flex; align-items: center; gap: 6px; margin-bottom: calc(-1 * var(--space-6, 24px)); width: fit-content;
  color: var(--text-muted); font-size: var(--text-sm); text-decoration: none; }
.tm-volver:hover { color: var(--color-jade-500); }
.tm-banda { position: relative; overflow: hidden; padding: var(--space-8, 32px) var(--space-6, 24px); border-radius: var(--radius-xl, 20px); color: #fff;
  background: linear-gradient(135deg, var(--m) 0%, color-mix(in srgb, var(--m) 55%, #061A18) 100%);
  box-shadow: 0 10px 30px color-mix(in srgb, var(--m) 30%, transparent); }
.tm-banda .nv-marca-simbolo { font-size: 120px; top: 0; right: 24px; }
.tm-banda h1 { margin: 0; font-size: var(--text-3xl); font-weight: 800; letter-spacing: -0.02em; }
.tm-lema { margin: 6px 0 0; font-weight: 600; opacity: .92; }
.tm-desc { margin: 10px 0 0; max-width: 620px; font-size: var(--text-sm); line-height: 1.6; opacity: .88; }
`
