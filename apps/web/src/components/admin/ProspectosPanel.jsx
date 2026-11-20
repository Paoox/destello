/**
 * Destello Admin — ProspectosPanel (19 nov 2026)
 *
 * Gente que se interesó en un taller y no lo tomó:
 *   · No pagaron          → se inscribió y su lugar se liberó sin pago
 *   · No alcanzaron lugar → intentó inscribirse y el taller estaba lleno
 *
 * Se filtran, se eligen y se les manda una invitación por WhatsApp (Faro) y
 * correo al abrir de nuevo el taller. Quien después pagó o está apartando ese
 * taller otra vez ya no aparece. Datos: GET/POST /admin/prospectos.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowClockwise, PaperPlaneTilt, WhatsappLogo, Envelope, UserMinus, Hourglass } from '@phosphor-icons/react'

const ORIGENES = [
  { id: '',         label: 'Todos' },
  { id: 'no_pago',  label: 'Se inscribieron y no pagaron' },
  { id: 'sin_cupo', label: 'No alcanzaron lugar' },
]

const ORIGEN_TAG = {
  no_pago:  { txt: 'No pagó',          color: 'var(--color-amber-500)', Icon: Hourglass },
  sin_cupo: { txt: 'No alcanzó lugar', color: '#8b5cf6',                Icon: UserMinus },
}

const clave = (p) => `${p.origen}|${p.email}|${p.tallerId}`
// 'YYYY-MM-DD' se arma como fecha local: con new Date() directo se corre un
// día en CDMX (ver @utils/fecha.js).
const fecha = (v) => {
  if (!v) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  const d = m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(v)
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: '2-digit' })
}

export default function ProspectosPanel({ adminToken }) {
  const headers = useMemo(() => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` }), [adminToken])
  const [origen, setOrigen]       = useState('')
  const [tallerId, setTallerId]   = useState('')
  const [lista, setLista]         = useState([])
  const [max, setMax]             = useState(60)
  const [cargando, setCargando]   = useState(false)
  const [talleres, setTalleres]   = useState([])
  const [elegidos, setElegidos]   = useState(() => new Set())
  const [invitarA, setInvitarA]   = useState('')
  const [enviando, setEnviando]   = useState(false)
  const [aviso, setAviso]         = useState(null)

  useEffect(() => {
    fetch('/api/admin/talleres', { headers }).then(r => r.json())
      .then(d => setTalleres(d.talleres ?? [])).catch(() => {})
  }, [headers])

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const qs = new URLSearchParams({ ...(origen && { origen }), ...(tallerId && { tallerId }) })
      const res = await fetch(`/api/admin/prospectos?${qs}`, { headers })
      const d = await res.json()
      setLista(res.ok ? d.prospectos ?? [] : [])
      if (d.maxPorEnvio) setMax(d.maxPorEnvio)
      setElegidos(new Set())
    } catch { setLista([]) } finally { setCargando(false) }
  }, [headers, origen, tallerId])
  useEffect(() => { cargar() }, [cargar])

  // Al filtrar por un taller, por default se invita a ese mismo taller.
  useEffect(() => { if (tallerId) setInvitarA(tallerId) }, [tallerId])

  const contactables = lista.filter(p => !p.noContactar)
  const todosMarcados = contactables.length > 0 && contactables.every(p => elegidos.has(clave(p)))
  const alternar = (p) => setElegidos(prev => {
    const s = new Set(prev); s.has(clave(p)) ? s.delete(clave(p)) : s.add(clave(p)); return s
  })
  const alternarTodos = () => setElegidos(todosMarcados ? new Set() : new Set(contactables.map(clave)))

  const seleccion = lista.filter(p => elegidos.has(clave(p)))
  const tallerInvitado = talleres.find(t => t.id === invitarA)
  const otroTaller = seleccion.some(p => p.tallerId !== invitarA)

  const enviar = async () => {
    if (!tallerInvitado) return
    const personas = new Set(seleccion.map(p => p.email)).size
    if (!confirm(
      `¿Invitar a ${personas} ${personas === 1 ? 'persona' : 'personas'} a "${tallerInvitado.nombre}"?\n\n` +
      'Les llega por WhatsApp (desde Faro) y por correo, con la fecha, horario y precio.' +
      (otroTaller ? '\n\n⚠️ Algunas querían OTRO taller.' : '')
    )) return
    setEnviando(true); setAviso(null)
    try {
      const res = await fetch('/api/admin/prospectos/invitar', {
        method: 'POST', headers,
        body: JSON.stringify({ tallerId: invitarA, seleccion: seleccion.map(p => ({ email: p.email, tallerId: p.tallerId, origen: p.origen })) }),
      })
      const d = await res.json()
      if (!res.ok) { setAviso({ ok: false, txt: d.message || 'No se pudo enviar' }); return }
      setAviso({ ok: true, txt:
        `Invitación enviada a ${d.invitados} · ${d.whatsapp} por WhatsApp · ${d.correo} por correo` +
        (d.omitidos?.length ? ` · ${d.omitidos.length} sin enviar (${d.omitidos.map(o => o.motivo).join(', ')})` : '') })
      cargar()
    } catch { setAviso({ ok: false, txt: 'Error de conexión' }) }
    finally { setEnviando(false) }
  }

  const abiertos = talleres.filter(t => ['activo', 'proximamente'].includes(t.estado))

  return (
    <div className="pr">
      <style>{CSS}</style>
      <div className="pr-cab">
        <div>
          <h2>Prospectos</h2>
          <p>Se interesaron en un taller y no lo tomaron. Invítalas cuando vuelva a abrir.</p>
        </div>
        <button className="pr-icono" onClick={cargar} disabled={cargando} title="Recargar"><ArrowClockwise size={16} /></button>
      </div>

      <div className="pr-filtros">
        {ORIGENES.map(o => (
          <button key={o.id} className={`pr-chip${origen === o.id ? ' on' : ''}`} onClick={() => setOrigen(o.id)}>{o.label}</button>
        ))}
        <select value={tallerId} onChange={e => setTallerId(e.target.value)} aria-label="Filtrar por taller">
          <option value="">Todos los talleres</option>
          {talleres.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>

      <div className="pr-envio">
        <span><strong>{seleccion.length}</strong> {seleccion.length === 1 ? 'elegida' : 'elegidas'}</span>
        <label>Invitar a
          <select value={invitarA} onChange={e => setInvitarA(e.target.value)}>
            <option value="">Elige el taller…</option>
            {abiertos.map(t => <option key={t.id} value={t.id}>{t.nombre}{t.fecha_inicio ? ` · ${fecha(t.fecha_inicio)}` : ''}</option>)}
          </select>
        </label>
        <button className="pr-btn" onClick={enviar}
          disabled={enviando || !seleccion.length || !invitarA || seleccion.length > max}>
          <PaperPlaneTilt size={15} weight="fill" />
          {enviando ? 'Enviando… (tarda unos segundos por persona)' : 'Enviar invitación (WhatsApp + correo)'}
        </button>
        {seleccion.length > max && <span className="pr-err">Máximo {max} por envío</span>}
      </div>
      {aviso && <p className={aviso.ok ? 'pr-ok' : 'pr-err'}>{aviso.txt}</p>}

      <div className="pr-tabla">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" checked={todosMarcados} onChange={alternarTodos} aria-label="Elegir todos" /></th>
              <th>Nombre</th><th>Contacto</th><th>Taller que quería</th><th>Motivo</th><th>Fecha</th><th>Invitada</th>
            </tr>
          </thead>
          <tbody>
            {cargando && <tr><td colSpan={7} className="pr-vacio">Cargando…</td></tr>}
            {!cargando && !lista.length && <tr><td colSpan={7} className="pr-vacio">No hay prospectos con estos filtros.</td></tr>}
            {!cargando && lista.map(p => {
              const tag = ORIGEN_TAG[p.origen]
              return (
                <tr key={clave(p)} className={p.noContactar ? 'pr-off' : ''} onClick={() => !p.noContactar && alternar(p)}>
                  <td><input type="checkbox" disabled={p.noContactar} checked={elegidos.has(clave(p))} onChange={() => alternar(p)} onClick={e => e.stopPropagation()} /></td>
                  <td>{p.nombre || '—'}{p.noContactar && <small> · cuenta bloqueada o dada de baja</small>}</td>
                  <td>
                    <div className="pr-contacto">
                      <span title={p.avisosCorreo ? '' : 'Apagó los avisos por correo'} className={p.avisosCorreo ? '' : 'pr-tachado'}><Envelope size={12} /> {p.email}</span>
                      {p.whatsapp
                        ? <span title={p.avisosWhatsapp ? '' : 'Apagó los avisos por WhatsApp'} className={p.avisosWhatsapp ? '' : 'pr-tachado'}><WhatsappLogo size={12} /> {p.whatsapp}</span>
                        : <span className="pr-mute">sin WhatsApp</span>}
                    </div>
                  </td>
                  <td>{p.tallerNombre}</td>
                  <td><span className="pr-tag" style={{ color: tag.color, borderColor: tag.color }}><tag.Icon size={12} weight="fill" /> {tag.txt}{p.intentos > 1 ? ` ×${p.intentos}` : ''}</span></td>
                  <td className="pr-mute">{fecha(p.fecha)}</td>
                  <td className="pr-mute">{p.invitaciones ? `${fecha(p.ultimaInvitacion)}${p.invitaciones > 1 ? ` (${p.invitaciones})` : ''}` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const CSS = `
.pr { display: flex; flex-direction: column; gap: var(--space-4); }
.pr-cab { display: flex; justify-content: space-between; align-items: flex-start; gap: var(--space-3); }
.pr-cab h2 { margin: 0; font-size: var(--text-xl); }
.pr-cab p { margin: 4px 0 0; color: var(--text-muted); font-size: var(--text-sm); }
.pr-icono { display: flex; padding: var(--space-2); background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: var(--radius-lg); color: var(--text-muted); cursor: pointer; }
.pr-filtros { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.pr-chip { padding: 6px 12px; border-radius: var(--radius-full); border: 1px solid var(--border-default); background: transparent; color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); cursor: pointer; }
.pr-chip.on { border-color: var(--color-jade-500); background: rgba(13,115,119,.12); color: var(--color-jade-500); font-weight: 600; }
.pr select { padding: 6px 10px; border-radius: var(--radius-md); border: 1px solid var(--border-default); background: var(--bg-surface); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-xs); max-width: 320px; }
.pr-envio { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; padding: var(--space-3); border: 1px solid var(--border-default); border-radius: var(--radius-lg); background: var(--bg-surface); font-size: var(--text-sm); }
.pr-envio label { display: flex; gap: 6px; align-items: center; color: var(--text-muted); }
.pr-btn { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; border-radius: var(--radius-full); border: none; background: var(--color-jade-500); color: #fff; font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 700; cursor: pointer; }
.pr-btn:disabled { opacity: .5; cursor: default; }
.pr-ok  { margin: 0; color: var(--color-jade-500); font-size: var(--text-sm); }
.pr-err { margin: 0; color: var(--color-error); font-size: var(--text-sm); }
.pr-tabla { overflow-x: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); }
.pr table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.pr th { text-align: left; padding: 10px 12px; font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; background: var(--bg-surface); white-space: nowrap; }
.pr td { padding: 10px 12px; border-top: 1px solid var(--border-subtle); vertical-align: top; }
.pr tbody tr { cursor: pointer; }
.pr tbody tr:hover { background: rgba(13,115,119,.05); }
.pr-off { opacity: .45; cursor: default !important; }
.pr-vacio { text-align: center; color: var(--text-muted); padding: var(--space-6) !important; }
.pr-contacto { display: flex; flex-direction: column; gap: 2px; font-size: var(--text-xs); }
.pr-contacto span { display: inline-flex; gap: 4px; align-items: center; }
.pr-tachado { text-decoration: line-through; opacity: .6; }
.pr-mute { color: var(--text-muted); font-size: var(--text-xs); white-space: nowrap; }
.pr-tag { display: inline-flex; align-items: center; gap: 4px; padding: 2px 9px; border: 1px solid; border-radius: var(--radius-full); font-size: var(--text-xs); font-weight: 600; white-space: nowrap; }
`
