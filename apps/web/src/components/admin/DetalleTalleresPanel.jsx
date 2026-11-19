/**
 * DetalleTalleresPanel — pestaña "Detalle talleres" del panel admin (19 nov 2026)
 *
 * Un renglón por taller con todo el recorrido: registrados → pagaron →
 * cortesías → pendientes → liberados → asistieron → certificados → ingresos.
 * Filtros por taller, categoría y fecha en que se imparte. Al elegir un
 * taller, abajo sale la lista de personas.
 *
 * Datos: GET /admin/metricas/talleres-detalle. "Pagaron" usa la misma regla
 * que el aviso a la profe (services/conteoAlumnos.js), así que los números
 * siempre cuadran con lo que ella ve.
 *
 * PDF: jsPDF + autotable, cargados solo al dar clic (no pesan en el panel).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DownloadSimple, CircleNotch, Funnel, X } from '@phosphor-icons/react'
import { fmtFechaLarga } from '@utils/fecha.js'

const COLUMNAS = [
  { k: 'registrados',  t: 'Registrados',  ayuda: 'Personas que se anotaron (una vez por persona)' },
  { k: 'pagaron',      t: 'Pagaron',      ayuda: 'Pago confirmado, sin contar cortesías' },
  { k: 'cortesias',    t: 'Cortesías',    ayuda: 'Lugar regalado (demo / cortesía)' },
  { k: 'pendientes',   t: 'Pendientes',   ayuda: 'Apartaron lugar pero no han pagado' },
  { k: 'liberados',    t: 'Liberados',    ayuda: 'No pagaron y se les liberó el lugar' },
  { k: 'asistieron',   t: 'Asistieron',   ayuda: 'Entraron al aula al menos una vez' },
  { k: 'certificados', t: 'Certificados', ayuda: 'Certificados vigentes emitidos' },
]

const dinero = (n) => `$${Number(n || 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}`
const PAGO_TXT = { si: 'Sí', no: 'No', cortesia: 'Cortesía' }
const ESTADO_TXT = {
  pendiente: 'Pendiente', cupo_confirmado: 'Lugar confirmado', confirmado: 'Lugar confirmado',
  pagado: 'Pagado', rechazado: 'Liberado',
}

export default function DetalleTalleresPanel({ adminToken }) {
  const [catalogo, setCatalogo]     = useState([])
  const [categorias, setCategorias] = useState([])
  const [filtros, setFiltros]       = useState({ tallerId: '', categoria: '', desde: '', hasta: '' })
  const [data, setData]             = useState(null)
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState(null)
  const [generando, setGenerando]   = useState(false)

  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${adminToken}` } }), [adminToken])

  useEffect(() => {
    fetch('/api/admin/talleres', auth).then(r => r.json())
      .then(d => setCatalogo(d.talleres ?? [])).catch(() => {})
    fetch('/api/admin/metricas/categorias', auth).then(r => r.json())
      .then(d => setCategorias(d.categorias ?? [])).catch(() => {})
  }, [auth])

  const cargar = useCallback(async () => {
    setCargando(true); setError(null)
    try {
      const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v)).toString()
      const res = await fetch(`/api/admin/metricas/talleres-detalle${qs ? `?${qs}` : ''}`, auth)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message ?? 'No se pudo cargar el detalle')
      setData(json)
    } catch (e) { setError(e.message) }
    finally { setCargando(false) }
  }, [auth, filtros])

  useEffect(() => { cargar() }, [cargar])

  const talleres = data?.talleres ?? []
  const personas = data?.personas ?? null
  const totales = useMemo(() => {
    const t = { ingresos: 0 }
    for (const c of COLUMNAS) t[c.k] = 0
    for (const r of talleres) {
      for (const c of COLUMNAS) t[c.k] += Number(r[c.k] || 0)
      t.ingresos += Number(r.ingresos || 0)
    }
    return t
  }, [talleres])

  const set = (k, v) => setFiltros(f => ({ ...f, [k]: v }))
  const hayFiltros = Object.values(filtros).some(Boolean)

  const descripcionFiltros = () => {
    const partes = []
    const tal = catalogo.find(t => t.id === filtros.tallerId)
    if (tal) partes.push(`Taller: ${tal.nombre}`)
    if (filtros.categoria) partes.push(`Categoría: ${filtros.categoria}`)
    if (filtros.desde) partes.push(`Desde: ${fmtFechaLarga(filtros.desde)}`)
    if (filtros.hasta) partes.push(`Hasta: ${fmtFechaLarga(filtros.hasta)}`)
    return partes.length ? partes.join('  ·  ') : 'Todos los talleres'
  }

  const descargarPdf = async () => {
    setGenerando(true)
    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        // '/es': la build ES trae `autoTable` como default de verdad. La
        // principal es UMD y su default depende de cómo la envuelva el bundler.
        import('jspdf'), import('jspdf-autotable/es'),
      ])
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' })
      const jade = [13, 115, 119]
      const hoy = new Date().toLocaleString('es-MX', { dateStyle: 'long', timeStyle: 'short' })

      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...jade)
      doc.text('Destello · Detalle de talleres', 40, 42)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90)
      doc.text(descripcionFiltros(), 40, 58)
      doc.text(`Generado el ${hoy}`, 40, 70)

      autoTable(doc, {
        startY: 84,
        head: [['Taller', 'Fecha', 'Profe', 'Cupo', ...COLUMNAS.map(c => c.t), 'Ingresos']],
        body: talleres.map(t => [
          t.nombre, fmtFechaLarga(t.fecha) ?? '—', t.profe ?? '—', t.cupo_maximo ?? '—',
          ...COLUMNAS.map(c => t[c.k]), dinero(t.ingresos),
        ]),
        foot: talleres.length > 1
          ? [['Total', '', '', '', ...COLUMNAS.map(c => totales[c.k]), dinero(totales.ingresos)]]
          : undefined,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: jade, textColor: 255 },
        footStyles: { fillColor: [235, 245, 244], textColor: 30, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 247, 242] },
        columnStyles: { 0: { cellWidth: 170 } },
      })

      if (personas?.length) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...jade)
        doc.text('Personas del taller', 40, doc.lastAutoTable.finalY + 28)
        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 36,
          head: [['Nombre', 'Correo', 'WhatsApp', 'Registro', 'Estado', 'Pagó', 'Asistió', 'Certificado']],
          body: personas.map(p => [
            p.nombre ?? '—', p.email, p.whatsapp ?? '—', fmtFechaLarga(p.registro) ?? '—',
            ESTADO_TXT[p.estado] ?? (p.estado || 'Solo entró al aula'), PAGO_TXT[p.pago] ?? '—',
            p.asistio ? `Sí (${p.minutos} min)` : 'No', p.certificado ?? '—',
          ]),
          styles: { fontSize: 8, cellPadding: 4 },
          headStyles: { fillColor: jade, textColor: 255 },
          alternateRowStyles: { fillColor: [250, 247, 242] },
        })
      }

      const tal = catalogo.find(t => t.id === filtros.tallerId)
      const nombre = tal ? tal.id.replace(/^taller-/, '') : 'talleres'
      doc.save(`destello-detalle-${nombre}-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (e) {
      setError(`No se pudo generar el PDF: ${e.message}`)
    } finally { setGenerando(false) }
  }

  return (
    <div>
      <style>{CSS}</style>

      {/* ── Filtros ── */}
      <div className="dt-filtros">
        <label>
          <span>Taller</span>
          <select value={filtros.tallerId} onChange={e => set('tallerId', e.target.value)}>
            <option value="">Todos los talleres</option>
            {catalogo.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </label>
        <label>
          <span>Categoría</span>
          <select value={filtros.categoria} onChange={e => set('categoria', e.target.value)}>
            <option value="">Todas</option>
            {categorias.map(c => <option key={c.categoria} value={c.categoria}>{c.categoria}</option>)}
          </select>
        </label>
        <label>
          <span>Se imparte desde</span>
          <input type="date" value={filtros.desde} onChange={e => set('desde', e.target.value)} />
        </label>
        <label>
          <span>hasta</span>
          <input type="date" value={filtros.hasta} onChange={e => set('hasta', e.target.value)} />
        </label>
        <div className="dt-acciones">
          {hayFiltros && (
            <button type="button" className="dt-btn dt-btn--ghost"
              onClick={() => setFiltros({ tallerId: '', categoria: '', desde: '', hasta: '' })}>
              <X size={14} /> Limpiar
            </button>
          )}
          <button type="button" className="dt-btn" onClick={descargarPdf}
            disabled={generando || cargando || !talleres.length}>
            {generando ? <CircleNotch size={16} className="dt-giro" /> : <DownloadSimple size={16} weight="bold" />}
            Descargar PDF
          </button>
        </div>
      </div>

      {error && <p className="dt-error">{error}</p>}

      {/* ── Tabla por taller ── */}
      {cargando ? (
        <div className="dt-vacio"><CircleNotch size={28} className="dt-giro" color="var(--color-jade-500)" /></div>
      ) : !talleres.length ? (
        <div className="dt-vacio"><Funnel size={28} /><p>No hay talleres con esos filtros.</p></div>
      ) : (
        <div className="dt-scroll">
          <table className="dt-tabla">
            <thead>
              <tr>
                <th className="dt-izq">Taller</th>
                <th className="dt-izq">Fecha</th>
                <th className="dt-izq">Profe</th>
                <th>Cupo</th>
                {COLUMNAS.map(c => <th key={c.k} title={c.ayuda}>{c.t}</th>)}
                <th>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {talleres.map(t => (
                <tr key={t.id}
                  className={filtros.tallerId === t.id ? 'dt-sel' : ''}
                  onClick={() => set('tallerId', filtros.tallerId === t.id ? '' : t.id)}
                  title="Clic para ver las personas de este taller">
                  <td className="dt-izq dt-nombre">{t.nombre}</td>
                  <td className="dt-izq dt-nowrap">{fmtFechaLarga(t.fecha) ?? '—'}</td>
                  <td className="dt-izq">{t.profe ?? '—'}</td>
                  <td>{t.cupo_maximo ?? '—'}</td>
                  {COLUMNAS.map(c => <td key={c.k} className={t[c.k] ? '' : 'dt-cero'}>{t[c.k]}</td>)}
                  <td className="dt-nowrap">{dinero(t.ingresos)}</td>
                </tr>
              ))}
            </tbody>
            {talleres.length > 1 && (
              <tfoot>
                <tr>
                  <td className="dt-izq" colSpan={4}>Total ({talleres.length} talleres)</td>
                  {COLUMNAS.map(c => <td key={c.k}>{totales[c.k]}</td>)}
                  <td className="dt-nowrap">{dinero(totales.ingresos)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── Personas del taller elegido ── */}
      {!cargando && personas && (
        <>
          <h3 className="dt-subtitulo">Personas del taller ({personas.length})</h3>
          {!personas.length ? (
            <div className="dt-vacio"><p>Nadie se ha registrado todavía.</p></div>
          ) : (
            <div className="dt-scroll">
              <table className="dt-tabla">
                <thead>
                  <tr>
                    <th className="dt-izq">Nombre</th>
                    <th className="dt-izq">Correo</th>
                    <th className="dt-izq">WhatsApp</th>
                    <th className="dt-izq">Registro</th>
                    <th className="dt-izq">Estado</th>
                    <th>Pagó</th>
                    <th>Asistió</th>
                    <th className="dt-izq">Certificado</th>
                  </tr>
                </thead>
                <tbody>
                  {personas.map(p => (
                    <tr key={p.email}>
                      <td className="dt-izq">{p.nombre ?? '—'}</td>
                      <td className="dt-izq">{p.email}</td>
                      <td className="dt-izq dt-nowrap">{p.whatsapp ?? '—'}</td>
                      <td className="dt-izq dt-nowrap">{fmtFechaLarga(p.registro) ?? '—'}</td>
                      <td className="dt-izq">{ESTADO_TXT[p.estado] ?? (p.estado || 'Solo entró al aula')}</td>
                      <td className={`dt-pago dt-pago--${p.pago}`}>{PAGO_TXT[p.pago] ?? '—'}</td>
                      <td className="dt-nowrap">{p.asistio ? `Sí · ${p.minutos} min` : 'No'}</td>
                      <td className="dt-izq dt-nowrap">{p.certificado ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const CSS = `
.dt-filtros {
  display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: flex-end;
  margin-bottom: var(--space-5);
}
.dt-filtros label { display: flex; flex-direction: column; gap: 4px; min-width: 150px; flex: 1 1 150px; }
.dt-filtros label span { font-size: var(--text-xs); color: var(--text-muted); font-weight: 600; }
.dt-filtros select, .dt-filtros input {
  padding: 8px 10px; border-radius: var(--radius-lg); border: 1px solid var(--border-default);
  background: var(--bg-surface); color: var(--text-primary);
  font-family: var(--font-sans); font-size: var(--text-sm);
}
.dt-acciones { display: flex; gap: var(--space-2); margin-left: auto; }
.dt-btn {
  display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px;
  border-radius: var(--radius-lg); border: 1px solid var(--color-jade-500);
  background: var(--color-jade-500); color: #fff; font-weight: 600;
  font-family: var(--font-sans); font-size: var(--text-sm); cursor: pointer; white-space: nowrap;
}
.dt-btn:disabled { opacity: .5; cursor: default; }
.dt-btn--ghost { background: transparent; color: var(--text-muted); border-color: var(--border-default); }
.dt-error { color: var(--color-amber-600); font-size: var(--text-sm); margin: 0 0 var(--space-3); }
.dt-vacio {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: var(--space-8); color: var(--text-muted); font-size: var(--text-sm);
  background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl);
}
.dt-vacio p { margin: 0; }
.dt-scroll {
  overflow-x: auto; background: var(--bg-card);
  border: 1px solid var(--border-subtle); border-radius: var(--radius-xl);
}
.dt-tabla { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
.dt-tabla th, .dt-tabla td { padding: 10px 12px; text-align: center; border-bottom: 1px solid var(--border-subtle); }
.dt-tabla th {
  font-size: var(--text-xs); font-weight: 700; color: var(--text-muted); text-transform: uppercase;
  letter-spacing: .04em; white-space: nowrap; cursor: help;
}
.dt-tabla tbody tr { cursor: pointer; transition: background .15s ease; }
.dt-tabla tbody tr:hover { background: rgba(13, 115, 119, 0.07); }
.dt-tabla tr.dt-sel { background: rgba(13, 115, 119, 0.14); }
.dt-tabla tfoot td { font-weight: 700; border-bottom: none; background: rgba(13, 115, 119, 0.08); }
.dt-izq { text-align: left !important; }
.dt-nowrap { white-space: nowrap; }
.dt-nombre { font-weight: 600; min-width: 200px; }
.dt-cero { color: var(--text-muted); opacity: .6; }
.dt-pago--si { color: var(--color-success, #16a34a); font-weight: 600; }
.dt-pago--cortesia { color: var(--color-amber-600); font-weight: 600; }
.dt-pago--no { color: var(--text-muted); }
.dt-subtitulo { margin: var(--space-6) 0 var(--space-3); font-size: var(--text-base); font-weight: 700; }
.dt-giro { animation: dt-giro .8s linear infinite; }
@keyframes dt-giro { to { transform: rotate(360deg) } }
@media (max-width: 600px) {
  .dt-acciones { margin-left: 0; width: 100%; }
  .dt-acciones .dt-btn { flex: 1; justify-content: center; }
}
`
