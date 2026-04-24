/**
 * Destello Admin — TalleresPanel
 * CRUD de talleres conectado a la tabla real.
 *
 * Columnas reales:
 *   id (slug), nombre, descripcion, precio, horario (texto "9:00 AM – 12:00 PM"),
 *   fecha_inicio (DATE), fecha_fin (DATE), cupo_maximo, imagen_url, estado
 */
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, PencilSimple, Plus, X, TrendUp } from '@phosphor-icons/react'
import { apiListTalleres, apiCreateTaller, apiUpdateTaller, apiGetTalleresStats } from '@services/adminApi.js'

// ── Opciones ──────────────────────────────────────────────────────────────────

const HORAS = [
    '12:00 AM','1:00 AM', '2:00 AM', '3:00 AM', '4:00 AM', '5:00 AM',
    '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM','11:00 AM',
    '12:00 PM','1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM',
    '6:00 PM', '7:00 PM', '8:00 PM', '9:00 PM', '10:00 PM','11:00 PM',
]

const ESTADOS = [
    { value: 'activo',       label: 'Activo',        color: '#22c55e' },
    { value: 'proximamente', label: 'Próximamente',  color: '#8b5cf6' },
    { value: 'lleno',        label: 'Lleno',         color: '#ef4444' },
    { value: 'inactivo',     label: 'Inactivo',      color: '#6b7280' },
]

function getEstadoCfg(val) {
    return ESTADOS.find(e => e.value === val) ?? { color: '#6b7280', label: val ?? '—' }
}

const EMPTY_FORM = {
    nombre:        '',
    descripcion:   '',
    precio:        '',
    horarioInicio: '9:00 AM',
    horarioFin:    '12:00 PM',
    fecha_inicio:  '',
    fecha_fin:     '',
    cupo_maximo:   '',
    imagen_url:    '',
    estado:        'activo',
    categoria:     '',
}

/** "9:00 AM" + "12:00 PM" → "9:00 AM – 12:00 PM" */
function buildHorario(inicio, fin) {
    if (!inicio && !fin) return null
    if (!fin)    return inicio
    if (!inicio) return fin
    return `${inicio} – ${fin}`
}

/** "9:00 AM – 12:00 PM" → { inicio: "9:00 AM", fin: "12:00 PM" } */
function parseHorario(horario) {
    if (!horario) return { inicio: '9:00 AM', fin: '12:00 PM' }
    const parts = horario.split(' – ')
    if (parts.length === 2) return { inicio: parts[0].trim(), fin: parts[1].trim() }
    // horario de una sola hora
    return { inicio: horario.trim(), fin: '12:00 PM' }
}

/** Formatea fecha ISO a "15 may 2026" */
function fmtFecha(iso) {
    if (!iso) return null
    const d = new Date(iso)
    if (isNaN(d)) return null
    return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Extrae solo "YYYY-MM-DD" de un ISO o DATE string */
function toDateInput(val) {
    if (!val) return ''
    return String(val).split('T')[0]
}

// ── Subcomponentes ────────────────────────────────────────────────────────────

function EstadoBadge({ estado }) {
    const cfg = getEstadoCfg(estado)
    return (
        <span style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 999,
            background: cfg.color + '22', color: cfg.color,
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
            {cfg.label}
        </span>
    )
}

function RankingDemanda({ stats }) {
    if (!stats || stats.length === 0) return null
    const topN     = stats.slice(0, 5)
    const maxTotal = Math.max(...topN.map(s => Number(s.total_espera)), 1)

    return (
        <div style={{ ...sCard, marginBottom: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
                <TrendUp size={16} color="var(--color-jade-500)" weight="fill" />
                <h3 style={{ fontWeight: 700, fontSize: 'var(--text-sm)', margin: 0 }}>Top talleres por demanda</h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>(personas en lista de espera)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {topN.map((s, i) => {
                    const total = Number(s.total_espera)
                    const pct   = total === 0 ? 0 : Math.round((total / maxTotal) * 100)
                    const medal = ['🥇','🥈','🥉'][i] ?? `${i + 1}.`
                    return (
                        <div key={s.id}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                    <span style={{ flexShrink: 0 }}>{medal}</span>
                                    <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {s.nombre}
                                    </span>
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, flexShrink: 0 }}>
                                    {total} {total === 1 ? 'persona' : 'personas'}
                                </span>
                            </div>
                            <div style={{ height: 5, background: 'var(--bg-surface)', borderRadius: 99, overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%', width: `${pct}%`, borderRadius: 99,
                                    background: i === 0 ? 'var(--color-jade-500)' : i === 1 ? 'var(--color-jade-500)aa' : 'var(--color-jade-500)55',
                                    transition: 'width 0.4s ease',
                                }} />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Formulario (crear y editar) ───────────────────────────────────────────────

function TallerForm({ form, onChange, onSubmit, submitting, submitLabel, error, onCancel }) {
    return (
        <form onSubmit={onSubmit}>
            {/* Fila 1: nombre + precio + estado */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                    <label style={sLabel}>Nombre *</label>
                    <input
                        type="text" required
                        placeholder="Ej: Auriculoterapia Nivel 1"
                        value={form.nombre}
                        onChange={e => onChange('nombre', e.target.value)}
                        style={sInput}
                    />
                </div>
                <div>
                    <label style={sLabel}>Precio (MXN)</label>
                    <input
                        type="number" min={0} placeholder="0"
                        value={form.precio}
                        onChange={e => onChange('precio', e.target.value)}
                        style={sInput}
                    />
                </div>
                <div>
                    <label style={sLabel}>Estado</label>
                    <select value={form.estado} onChange={e => onChange('estado', e.target.value)} style={sInput}>
                        {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                </div>
            </div>

            {/* Fila 2: horario inicio + fin */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                    <label style={sLabel}>Horario — inicia a las</label>
                    <select value={form.horarioInicio} onChange={e => onChange('horarioInicio', e.target.value)} style={sInput}>
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
                <div>
                    <label style={sLabel}>Horario — termina a las</label>
                    <select value={form.horarioFin} onChange={e => onChange('horarioFin', e.target.value)} style={sInput}>
                        {HORAS.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                </div>
            </div>

            {/* Fila 3: fecha inicio + fecha fin + cupo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                    <label style={sLabel}>Fecha inicio</label>
                    <input
                        type="date"
                        value={form.fecha_inicio}
                        onChange={e => onChange('fecha_inicio', e.target.value)}
                        style={sInput}
                    />
                </div>
                <div>
                    <label style={sLabel}>Fecha fin <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span></label>
                    <input
                        type="date"
                        value={form.fecha_fin}
                        onChange={e => onChange('fecha_fin', e.target.value)}
                        style={sInput}
                    />
                </div>
                <div>
                    <label style={sLabel}>Cupo máximo <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span></label>
                    <input
                        type="number" min={1} placeholder="Sin límite"
                        value={form.cupo_maximo}
                        onChange={e => onChange('cupo_maximo', e.target.value)}
                        style={sInput}
                    />
                </div>
            </div>

            {/* Fila 4: categoria + imagen url */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <div>
                    <label style={sLabel}>Categoría <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span></label>
                    <input
                        type="text" placeholder="Ej: Bienestar, Arte…"
                        value={form.categoria}
                        onChange={e => onChange('categoria', e.target.value)}
                        style={sInput}
                    />
                </div>
                <div>
                    <label style={sLabel}>URL de imagen <span style={{ fontWeight: 400, opacity: 0.6 }}>(opcional)</span></label>
                    <input
                        type="url" placeholder="https://..."
                        value={form.imagen_url}
                        onChange={e => onChange('imagen_url', e.target.value)}
                        style={sInput}
                    />
                </div>
            </div>

            {/* Fila 5: descripción */}
            <div style={{ marginBottom: 'var(--space-4)' }}>
                <label style={sLabel}>Descripción</label>
                <textarea
                    placeholder="Breve descripción del taller…"
                    value={form.descripcion}
                    onChange={e => onChange('descripcion', e.target.value)}
                    rows={2}
                    style={{ ...sInput, resize: 'vertical' }}
                />
            </div>

            {error && (
                <p style={{ color: 'var(--color-error)', fontSize: 12, margin: '0 0 var(--space-3)' }}>
                    ⚠ {error}
                </p>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button
                    type="submit"
                    disabled={submitting || !form.nombre.trim()}
                    style={{
                        ...sBtnPrimary,
                        opacity: submitting || !form.nombre.trim() ? 0.5 : 1,
                        cursor:  submitting || !form.nombre.trim() ? 'not-allowed' : 'pointer',
                    }}
                >
                    {submitting ? 'Guardando...' : submitLabel}
                </button>
                {onCancel && (
                    <button type="button" onClick={onCancel} style={sBtnSecondary}>
                        Cancelar
                    </button>
                )}
            </div>
        </form>
    )
}

// ── Panel principal ───────────────────────────────────────────────────────────

export default function TalleresPanel({ adminToken }) {
    const [talleres,    setTalleres]    = useState([])
    const [talStats,    setTalStats]    = useState([])
    const [loading,     setLoading]     = useState(false)
    const [loaded,      setLoaded]      = useState(false)
    const [error,       setError]       = useState(null)

    const [editingId,   setEditingId]   = useState(null)
    const [editForm,    setEditForm]    = useState({})
    const [saving,      setSaving]      = useState(false)
    const [saveError,   setSaveError]   = useState(null)

    const [showCreate,  setShowCreate]  = useState(false)
    const [createForm,  setCreateForm]  = useState(EMPTY_FORM)
    const [creating,    setCreating]    = useState(false)
    const [createError, setCreateError] = useState(null)

    const fetchTalleres = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            // Stats puede no existir aún — no bloqueamos si falla
            const [talData, statsData] = await Promise.allSettled([
                apiListTalleres(adminToken),
                apiGetTalleresStats(adminToken),
            ])
            if (talData.status === 'fulfilled') {
                setTalleres(talData.value.talleres ?? [])
                setLoaded(true)
            } else {
                setError(talData.reason?.message ?? 'Error cargando talleres')
            }
            if (statsData.status === 'fulfilled') {
                setTalStats(statsData.value.stats ?? [])
            }
        } catch (err) { setError(err.message) }
        finally { setLoading(false) }
    }, [adminToken])

    useEffect(() => { fetchTalleres() }, [fetchTalleres])

    // ── Editar ────────────────────────────────────────────────
    const startEdit = (taller) => {
        const { inicio, fin } = parseHorario(taller.horario)
        setEditingId(taller.id)
        setSaveError(null)
        setEditForm({
            nombre:        taller.nombre,
            descripcion:   taller.descripcion || '',
            precio:        taller.precio ?? '',
            horarioInicio: inicio,
            horarioFin:    fin,
            fecha_inicio:  toDateInput(taller.fecha_inicio),
            fecha_fin:     toDateInput(taller.fecha_fin),
            cupo_maximo:   taller.cupo_maximo ?? '',
            imagen_url:    taller.imagen_url || '',
            estado:        taller.estado || 'activo',
            categoria:     taller.categoria || '',
        })
    }

    const cancelEdit = () => { setEditingId(null); setEditForm({}); setSaveError(null) }
    const handleEditChange = (field, value) => setEditForm(p => ({ ...p, [field]: value }))

    const handleSave = async (e) => {
        e.preventDefault()
        setSaving(true); setSaveError(null)
        try {
            const body = {
                nombre:       editForm.nombre.trim(),
                descripcion:  editForm.descripcion || null,
                precio:       editForm.precio !== '' ? Number(editForm.precio) : null,
                horario:      buildHorario(editForm.horarioInicio, editForm.horarioFin),
                fecha_inicio: editForm.fecha_inicio || null,
                fecha_fin:    editForm.fecha_fin    || null,
                cupo_maximo:  editForm.cupo_maximo !== '' ? Number(editForm.cupo_maximo) : null,
                imagen_url:   editForm.imagen_url   || null,
                estado:       editForm.estado,
                categoria:    editForm.categoria    || null,
            }
            const data = await apiUpdateTaller(adminToken, editingId, body)
            setTalleres(prev => prev.map(t => t.id === editingId ? data.taller : t))
            setEditingId(null)
        } catch (err) { setSaveError(err.message) }
        finally { setSaving(false) }
    }

    // ── Crear ─────────────────────────────────────────────────
    const handleCreateChange = (field, value) => setCreateForm(p => ({ ...p, [field]: value }))

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!createForm.nombre.trim()) return
        setCreating(true); setCreateError(null)
        try {
            const body = {
                nombre:       createForm.nombre.trim(),
                descripcion:  createForm.descripcion || null,
                precio:       createForm.precio !== '' ? Number(createForm.precio) : 0,
                horario:      buildHorario(createForm.horarioInicio, createForm.horarioFin),
                fecha_inicio: createForm.fecha_inicio || null,
                fecha_fin:    createForm.fecha_fin    || null,
                cupo_maximo:  createForm.cupo_maximo !== '' ? Number(createForm.cupo_maximo) : null,
                imagen_url:   createForm.imagen_url   || null,
                estado:       createForm.estado,
                categoria:    createForm.categoria    || null,
            }
            const data = await apiCreateTaller(adminToken, body)
            setTalleres(prev => [data.taller, ...prev])
            setCreateForm(EMPTY_FORM)
            setShowCreate(false)
        } catch (err) { setCreateError(err.message) }
        finally { setCreating(false) }
    }

    // ── Render ────────────────────────────────────────────────
    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <BookOpen size={20} color="var(--color-jade-500)" weight="fill" />
                    <h2 style={{ fontWeight: 700, fontSize: 'var(--text-lg)', margin: 0 }}>
                        Talleres {loaded && `(${talleres.length})`}
                    </h2>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                        onClick={() => { setShowCreate(v => !v); setCreateError(null) }}
                        style={{
                            ...sBtnPrimary,
                            background: showCreate ? 'var(--bg-surface)' : 'var(--color-jade-500)',
                            border: `1px solid var(--color-jade-500)`,
                            color: showCreate ? 'var(--color-jade-500)' : '#fff',
                            display: 'flex', alignItems: 'center', gap: 6,
                        }}
                    >
                        {showCreate ? <X size={13} /> : <Plus size={13} />}
                        {showCreate ? 'Cancelar' : 'Nuevo taller'}
                    </button>
                    <button onClick={fetchTalleres} disabled={loading} style={{ ...sBtnSecondary, opacity: loading ? 0.5 : 1 }}>
                        {loading ? 'Cargando...' : '↺ Actualizar'}
                    </button>
                </div>
            </div>

            {/* Formulario nuevo taller */}
            {showCreate && (
                <div style={{ ...sCard, borderColor: 'var(--color-jade-500)44', marginBottom: 'var(--space-5)' }}>
                    <h3 style={{ fontWeight: 700, margin: '0 0 var(--space-4)', fontSize: 'var(--text-base)' }}>
                        ✦ Crear nuevo taller
                    </h3>
                    <TallerForm
                        form={createForm}
                        onChange={handleCreateChange}
                        onSubmit={handleCreate}
                        submitting={creating}
                        submitLabel="✦ Crear taller"
                        error={createError}
                        onCancel={() => { setShowCreate(false); setCreateForm(EMPTY_FORM) }}
                    />
                </div>
            )}

            {/* Ranking demanda */}
            {loaded && <RankingDemanda stats={talStats} />}

            {error && (
                <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                    Error: {error}
                </p>
            )}

            {/* Tabla */}
            {loaded && talleres.length > 0 && (
                <div style={{ ...sCard, padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                            <thead>
                            <tr style={{ background: 'var(--bg-surface)' }}>
                                {['Nombre', 'Horario', 'Fechas', 'Precio', 'Estado', 'Acción'].map(h => (
                                    <th key={h} style={sTh}>{h}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {talleres.map(t => (
                                <>
                                    <tr key={t.id} style={{
                                        borderTop: '1px solid var(--border-subtle)',
                                        background: editingId === t.id ? 'var(--color-jade-500)08' : undefined,
                                    }}>
                                        <td style={{ ...sTd, fontWeight: 600 }}>
                                            {t.nombre}
                                            {t.descripcion && (
                                                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                                                    {t.descripcion.slice(0, 55)}{t.descripcion.length > 55 ? '…' : ''}
                                                </p>
                                            )}
                                        </td>
                                        <td style={{ ...sTd, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {t.horario || <span style={{ opacity: 0.35 }}>—</span>}
                                        </td>
                                        <td style={{ ...sTd, color: 'var(--text-muted)', fontSize: 11, whiteSpace: 'nowrap' }}>
                                            {t.fecha_inicio
                                                ? <>{fmtFecha(t.fecha_inicio)}{t.fecha_fin ? <><br /><span style={{ opacity: 0.6 }}>→ {fmtFecha(t.fecha_fin)}</span></> : null}</>
                                                : <span style={{ opacity: 0.35 }}>—</span>
                                            }
                                        </td>
                                        <td style={{ ...sTd, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                            {t.precio != null && Number(t.precio) > 0
                                                ? `$${Number(t.precio).toLocaleString('es-MX')}`
                                                : <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 12 }}>Gratis</span>
                                            }
                                        </td>
                                        <td style={sTd}>
                                            <EstadoBadge estado={t.estado} />
                                        </td>
                                        <td style={sTd}>
                                            <button
                                                onClick={() => editingId === t.id ? cancelEdit() : startEdit(t)}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    padding: '4px 10px',
                                                    background: editingId === t.id ? 'var(--color-jade-500)22' : 'none',
                                                    border: `1px solid ${editingId === t.id ? 'var(--color-jade-500)' : 'var(--border-default)'}`,
                                                    borderRadius: 'var(--radius-md)',
                                                    color: editingId === t.id ? 'var(--color-jade-500)' : 'var(--text-muted)',
                                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                                    fontFamily: 'var(--font-sans)',
                                                }}
                                            >
                                                {editingId === t.id ? <X size={12} /> : <PencilSimple size={12} />}
                                                {editingId === t.id ? 'Cerrar' : 'Editar'}
                                            </button>
                                        </td>
                                    </tr>

                                    {/* Panel de edición expandido */}
                                    {editingId === t.id && (
                                        <tr key={`${t.id}-edit`}>
                                            <td colSpan={6} style={{ padding: '0 var(--space-4) var(--space-4)', background: 'var(--color-jade-500)05' }}>
                                                <div style={{
                                                    background: 'var(--bg-card)',
                                                    border: '1px solid var(--color-jade-500)33',
                                                    borderRadius: 'var(--radius-lg)',
                                                    padding: 'var(--space-4)',
                                                }}>
                                                    <p style={{ margin: '0 0 var(--space-3)', fontSize: 12, fontWeight: 700, color: 'var(--color-jade-500)' }}>
                                                        ✦ Editando: {t.nombre}
                                                    </p>
                                                    <TallerForm
                                                        form={editForm}
                                                        onChange={handleEditChange}
                                                        onSubmit={handleSave}
                                                        submitting={saving}
                                                        submitLabel={saving ? 'Guardando...' : '✓ Guardar cambios'}
                                                        error={saveError}
                                                        onCancel={cancelEdit}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {loaded && talleres.length === 0 && (
                <div style={{ ...sCard, textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                    <BookOpen size={32} style={{ opacity: 0.3, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                    No hay talleres registrados aún
                </div>
            )}
        </div>
    )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const sCard = {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    padding: 'var(--space-5)',
}
const sLabel = {
    display: 'block', fontSize: 11, color: 'var(--text-muted)',
    marginBottom: 4, fontWeight: 600,
}
const sInput = {
    width: '100%', padding: 'var(--space-3)',
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    outline: 'none', boxSizing: 'border-box',
}
const sBtnPrimary = {
    padding: 'var(--space-2) var(--space-4)',
    background: 'var(--color-jade-500)',
    border: '1px solid transparent',
    borderRadius: 'var(--radius-lg)',
    color: '#fff', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
    transition: 'opacity 0.15s',
}
const sBtnSecondary = {
    padding: 'var(--space-2) var(--space-4)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-muted)', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
}
const sTh = {
    padding: 'var(--space-3) var(--space-4)',
    textAlign: 'left', color: 'var(--text-muted)',
    fontWeight: 500, fontSize: 11, whiteSpace: 'nowrap',
}
const sTd = { padding: 'var(--space-3) var(--space-4)', verticalAlign: 'middle' }