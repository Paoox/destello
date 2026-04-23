/**
 * Destello Admin — TalleresPanel
 * CRUD de talleres: crear, editar estado, ver lista.
 */
import { useState, useEffect, useCallback } from 'react'
import { BookOpen, PencilSimple, CheckCircle, Plus, X, TrendUp, Users } from '@phosphor-icons/react'
import { apiListTalleres, apiCreateTaller, apiUpdateTaller, apiGetTalleresStats } from '@services/adminApi.js'

const ESTADO_COLOR = {
    activo:    { color: '#22c55e',            label: 'Activo'    },
    inactivo:  { color: 'var(--text-muted)',  label: 'Inactivo'  },
    pendiente: { color: '#f59e0b',            label: 'Pendiente' },
}

function EstadoBadge({ estado }) {
    const cfg = ESTADO_COLOR[estado] ?? { color: 'var(--text-muted)', label: estado }
    return (
        <span style={{
            display:      'inline-block',
            padding:      '2px 10px',
            borderRadius: 999,
            background:   cfg.color + '22',
            color:        cfg.color,
            fontSize:     'var(--text-xs)',
            fontWeight:   600,
        }}>
            {cfg.label}
        </span>
    )
}

const EMPTY_FORM = { nombre: '', descripcion: '', precio: '', horario: '', categoria: '' }

// ── Ranking de demanda ──────────────────────────────────────────────────────
function RankingDemanda({ stats }) {
    if (!stats || stats.length === 0) return null

    const topN     = stats.slice(0, 5)
    const maxTotal = Math.max(...topN.map(s => Number(s.total_espera)), 1)

    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding:      'var(--space-5) var(--space-6)',
            marginBottom: 'var(--space-6)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-4)' }}>
                <TrendUp size={18} color="var(--color-jade-500)" weight="fill" />
                <h3 style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Top talleres por demanda</h3>
                <span style={{
                    fontSize:   'var(--text-xs)',
                    color:      'var(--text-muted)',
                    fontWeight: 400,
                    marginLeft: 4,
                }}>
                    (personas en lista de espera)
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {topN.map((s, i) => {
                    const total      = Number(s.total_espera)
                    const pendientes = Number(s.pendientes)
                    const confirmados = Number(s.confirmados)
                    const pct        = total === 0 ? 0 : Math.round((total / maxTotal) * 100)
                    const medal      = ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`

                    return (
                        <div key={s.id}>
                            <div style={{
                                display:        'flex',
                                alignItems:     'center',
                                justifyContent: 'space-between',
                                marginBottom:   4,
                                gap:            'var(--space-2)',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                    <span style={{ fontSize: 'var(--text-sm)', lineHeight: 1, flexShrink: 0 }}>{medal}</span>
                                    <span style={{
                                        fontSize:     'var(--text-sm)',
                                        fontWeight:   600,
                                        overflow:     'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace:   'nowrap',
                                    }}>
                                        {s.nombre}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexShrink: 0 }}>
                                    {pendientes > 0 && (
                                        <span style={{
                                            fontSize:    'var(--text-xs)',
                                            color:       '#f59e0b',
                                            background:  '#f59e0b22',
                                            padding:     '1px 7px',
                                            borderRadius: 999,
                                            fontWeight:  600,
                                        }}>
                                            {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    <span style={{
                                        fontSize:    'var(--text-xs)',
                                        color:       'var(--text-muted)',
                                        fontWeight:  600,
                                        minWidth:    40,
                                        textAlign:   'right',
                                    }}>
                                        {total} {total === 1 ? 'persona' : 'personas'}
                                    </span>
                                </div>
                            </div>
                            {/* Barra de progreso */}
                            <div style={{
                                height:     6,
                                background: 'var(--bg-surface)',
                                borderRadius: 99,
                                overflow:   'hidden',
                            }}>
                                <div style={{
                                    height:      '100%',
                                    width:       `${pct}%`,
                                    background:  i === 0
                                        ? 'var(--color-jade-500)'
                                        : i === 1
                                            ? 'var(--color-jade-500)aa'
                                            : 'var(--color-jade-500)66',
                                    borderRadius: 99,
                                    transition:  'width 0.4s ease',
                                }} />
                            </div>
                        </div>
                    )
                })}
            </div>

            {stats.every(s => Number(s.total_espera) === 0) && (
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center', paddingTop: 'var(--space-2)' }}>
                    Aún no hay registros en lista de espera
                </p>
            )}
        </div>
    )
}

export default function TalleresPanel({ adminToken }) {
    const [talleres,    setTalleres]    = useState([])
    const [talStats,    setTalStats]    = useState([])
    const [loading,     setLoading]     = useState(false)
    const [loaded,      setLoaded]      = useState(false)
    const [error,       setError]       = useState(null)
    const [editingId,   setEditingId]   = useState(null)  // id del taller editando inline
    const [editFields,  setEditFields]  = useState({})
    const [saving,      setSaving]      = useState(false)
    const [showCreate,  setShowCreate]  = useState(false)
    const [createForm,  setCreateForm]  = useState(EMPTY_FORM)
    const [creating,    setCreating]    = useState(false)
    const [createError, setCreateError] = useState(null)

    const fetchTalleres = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [talData, statsData] = await Promise.all([
                apiListTalleres(adminToken),
                apiGetTalleresStats(adminToken),
            ])
            setTalleres(talData.talleres)
            setTalStats(statsData.stats)
            setLoaded(true)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [adminToken])

    // Carga automática al montar el componente (al entrar al tab)
    useEffect(() => { fetchTalleres() }, [fetchTalleres])

    const startEdit = (taller) => {
        setEditingId(taller.id)
        setEditFields({
            nombre:      taller.nombre,
            descripcion: taller.descripcion || '',
            precio:      taller.precio ?? '',
            horario:     taller.horario || '',
            categoria:   taller.categoria || '',
            estado:      taller.estado,
        })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditFields({})
    }

    const handleSave = async (id) => {
        setSaving(true)
        try {
            const data = await apiUpdateTaller(adminToken, id, editFields)
            setTalleres(prev => prev.map(t => t.id === id ? data.taller : t))
            setEditingId(null)
        } catch (err) {
            alert('Error al guardar: ' + err.message)
        } finally {
            setSaving(false)
        }
    }

    const toggleEstado = async (taller) => {
        const nuevoEstado = taller.estado === 'activo' ? 'inactivo' : 'activo'
        try {
            const data = await apiUpdateTaller(adminToken, taller.id, { estado: nuevoEstado })
            setTalleres(prev => prev.map(t => t.id === taller.id ? data.taller : t))
        } catch (err) {
            alert('Error: ' + err.message)
        }
    }

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!createForm.nombre.trim()) return
        setCreating(true)
        setCreateError(null)
        try {
            const body = {
                nombre:      createForm.nombre.trim(),
                descripcion: createForm.descripcion || undefined,
                precio:      createForm.precio !== '' ? Number(createForm.precio) : undefined,
                horario:     createForm.horario || undefined,
                categoria:   createForm.categoria || undefined,
            }
            const data = await apiCreateTaller(adminToken, body)
            setTalleres(prev => [data.taller, ...prev])
            setCreateForm(EMPTY_FORM)
            setShowCreate(false)
        } catch (err) {
            setCreateError(err.message)
        } finally {
            setCreating(false)
        }
    }

    return (
        <div>
            {/* Header */}
            <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                marginBottom:   'var(--space-5)',
                flexWrap:       'wrap',
                gap:            'var(--space-3)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <BookOpen size={22} color="var(--color-jade-500)" weight="fill" />
                    <h2 style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>
                        Talleres {loaded && `(${talleres.length})`}
                    </h2>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                        onClick={() => setShowCreate(v => !v)}
                        style={{
                            display:      'flex',
                            alignItems:   'center',
                            gap:          6,
                            padding:      'var(--space-2) var(--space-4)',
                            background:   showCreate ? 'var(--bg-surface)' : 'var(--color-jade-500)',
                            border:       '1px solid var(--color-jade-500)',
                            borderRadius: 'var(--radius-lg)',
                            color:        showCreate ? 'var(--color-jade-500)' : 'var(--text-primary)',
                            fontSize:     'var(--text-xs)',
                            fontWeight:   600,
                            cursor:       'pointer',
                            fontFamily:   'var(--font-sans)',
                        }}
                    >
                        {showCreate ? <X size={14} /> : <Plus size={14} />}
                        {showCreate ? 'Cancelar' : 'Nuevo taller'}
                    </button>

                    <button
                        onClick={fetchTalleres}
                        disabled={loading}
                        style={{
                            padding:      'var(--space-2) var(--space-4)',
                            background:   'var(--bg-surface)',
                            border:       '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)',
                            color:        'var(--text-muted)',
                            fontSize:     'var(--text-xs)',
                            fontWeight:   500,
                            cursor:       loading ? 'wait' : 'pointer',
                            fontFamily:   'var(--font-sans)',
                        }}
                    >
                        {loading ? 'Cargando...' : loaded ? '↺ Actualizar' : 'Cargar talleres'}
                    </button>
                </div>
            </div>

            {/* Formulario nuevo taller */}
            {showCreate && (
                <div style={{
                    marginBottom:  'var(--space-6)',
                    background:    'var(--bg-card)',
                    border:        '1px solid var(--color-jade-500)44',
                    borderRadius:  'var(--radius-xl)',
                    padding:       'var(--space-6)',
                }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--text-base)' }}>
                        ✦ Crear nuevo taller
                    </h3>
                    <form onSubmit={handleCreate}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                            <div>
                                <label style={labelStyle}>Nombre *</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Auriculoterapia Nivel 1"
                                    value={createForm.nombre}
                                    onChange={e => setCreateForm(p => ({ ...p, nombre: e.target.value }))}
                                    style={inputStyle}
                                    required
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Categoría</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Bienestar, Arte, Cocina…"
                                    value={createForm.categoria}
                                    onChange={e => setCreateForm(p => ({ ...p, categoria: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Horario</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Lunes 10am"
                                    value={createForm.horario}
                                    onChange={e => setCreateForm(p => ({ ...p, horario: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>
                            <div>
                                <label style={labelStyle}>Precio (MXN)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    min={0}
                                    value={createForm.precio}
                                    onChange={e => setCreateForm(p => ({ ...p, precio: e.target.value }))}
                                    style={inputStyle}
                                />
                            </div>
                        </div>
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                            <label style={labelStyle}>Descripción</label>
                            <textarea
                                placeholder="Breve descripción del taller…"
                                value={createForm.descripcion}
                                onChange={e => setCreateForm(p => ({ ...p, descripcion: e.target.value }))}
                                rows={2}
                                style={{ ...inputStyle, resize: 'vertical' }}
                            />
                        </div>

                        {createError && (
                            <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>
                                {createError}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={creating || !createForm.nombre.trim()}
                            style={{
                                padding:      'var(--space-3) var(--space-6)',
                                background:   creating || !createForm.nombre.trim() ? 'var(--bg-surface)' : 'var(--color-jade-500)',
                                border:       '1px solid transparent',
                                borderRadius: 'var(--radius-lg)',
                                color:        'var(--text-primary)',
                                fontWeight:   600,
                                fontSize:     'var(--text-sm)',
                                cursor:       creating || !createForm.nombre.trim() ? 'not-allowed' : 'pointer',
                                fontFamily:   'var(--font-sans)',
                            }}
                        >
                            {creating ? 'Creando...' : '✦ Crear taller'}
                        </button>
                    </form>
                </div>
            )}

            {/* Ranking de demanda */}
            {loaded && <RankingDemanda stats={talStats} />}

            {error && (
                <div style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                    Error: {error}
                </div>
            )}

            {!loaded && !loading && (
                <div style={{
                    textAlign:    'center',
                    padding:      'var(--space-16)',
                    color:        'var(--text-muted)',
                    fontSize:     'var(--text-sm)',
                    background:   'var(--bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    border:       '1px solid var(--border-default)',
                }}>
                    <BookOpen size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                    <p>Haz clic en "Cargar talleres" para ver el catálogo</p>
                </div>
            )}

            {/* Lista de talleres */}
            {loaded && talleres.length === 0 && (
                <div style={{
                    textAlign:    'center',
                    padding:      'var(--space-16)',
                    color:        'var(--text-muted)',
                    fontSize:     'var(--text-sm)',
                    background:   'var(--bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    border:       '1px solid var(--border-default)',
                }}>
                    No hay talleres registrados aún
                </div>
            )}

            {loaded && talleres.length > 0 && (
                <div style={{
                    background:   'var(--bg-card)',
                    border:       '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)',
                    overflow:     'hidden',
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                            <thead>
                            <tr style={{ background: 'var(--bg-surface)' }}>
                                {['Nombre', 'Categoría', 'Horario', 'Precio', 'Estado', 'Acciones'].map(h => (
                                    <th key={h} style={{
                                        padding:    'var(--space-3) var(--space-4)',
                                        textAlign:  'left',
                                        color:      'var(--text-muted)',
                                        fontWeight: 500,
                                        fontSize:   'var(--text-xs)',
                                        whiteSpace: 'nowrap',
                                    }}>
                                        {h}
                                    </th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {talleres.map(t => (
                                <tr key={t.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                    {editingId === t.id ? (
                                        /* Fila edición inline */
                                        <>
                                            <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                                <input
                                                    value={editFields.nombre}
                                                    onChange={e => setEditFields(p => ({ ...p, nombre: e.target.value }))}
                                                    style={{ ...inputStyle, padding: 'var(--space-2)' }}
                                                />
                                            </td>
                                            <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                                <input
                                                    value={editFields.categoria}
                                                    onChange={e => setEditFields(p => ({ ...p, categoria: e.target.value }))}
                                                    style={{ ...inputStyle, padding: 'var(--space-2)' }}
                                                    placeholder="Categoría"
                                                />
                                            </td>
                                            <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                                <input
                                                    value={editFields.horario}
                                                    onChange={e => setEditFields(p => ({ ...p, horario: e.target.value }))}
                                                    style={{ ...inputStyle, padding: 'var(--space-2)' }}
                                                    placeholder="Horario"
                                                />
                                            </td>
                                            <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={editFields.precio}
                                                    onChange={e => setEditFields(p => ({ ...p, precio: e.target.value }))}
                                                    style={{ ...inputStyle, padding: 'var(--space-2)', width: 90 }}
                                                />
                                            </td>
                                            <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                                <select
                                                    value={editFields.estado}
                                                    onChange={e => setEditFields(p => ({ ...p, estado: e.target.value }))}
                                                    style={{ ...inputStyle, padding: 'var(--space-2)' }}
                                                >
                                                    <option value="activo">Activo</option>
                                                    <option value="inactivo">Inactivo</option>
                                                    <option value="pendiente">Pendiente</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                                    <button
                                                        onClick={() => handleSave(t.id)}
                                                        disabled={saving}
                                                        style={{
                                                            display:      'flex',
                                                            alignItems:   'center',
                                                            gap:          4,
                                                            padding:      '4px 10px',
                                                            background:   'var(--color-jade-500)22',
                                                            border:       '1px solid var(--color-jade-500)',
                                                            borderRadius: 'var(--radius-md)',
                                                            color:        'var(--color-jade-500)',
                                                            fontSize:     'var(--text-xs)',
                                                            fontWeight:   600,
                                                            cursor:       saving ? 'wait' : 'pointer',
                                                            fontFamily:   'var(--font-sans)',
                                                            whiteSpace:   'nowrap',
                                                        }}
                                                    >
                                                        <CheckCircle size={13} weight="fill" />
                                                        {saving ? 'Guardando…' : 'Guardar'}
                                                    </button>
                                                    <button
                                                        onClick={cancelEdit}
                                                        style={{
                                                            padding:      '4px 8px',
                                                            background:   'none',
                                                            border:       '1px solid var(--border-default)',
                                                            borderRadius: 'var(--radius-md)',
                                                            color:        'var(--text-muted)',
                                                            fontSize:     'var(--text-xs)',
                                                            cursor:       'pointer',
                                                            fontFamily:   'var(--font-sans)',
                                                        }}
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        /* Fila lectura */
                                        <>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 600 }}>
                                                {t.nombre}
                                                {t.descripcion && (
                                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>
                                                        {t.descripcion}
                                                    </p>
                                                )}
                                            </td>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)' }}>
                                                {t.categoria || <span style={{ opacity: 0.4 }}>—</span>}
                                            </td>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {t.horario || <span style={{ opacity: 0.4 }}>—</span>}
                                            </td>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {t.precio != null ? `$${Number(t.precio).toLocaleString('es-MX')}` : <span style={{ opacity: 0.4 }}>—</span>}
                                            </td>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                                <button
                                                    onClick={() => toggleEstado(t)}
                                                    title="Cambiar estado"
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                                >
                                                    <EstadoBadge estado={t.estado} />
                                                </button>
                                            </td>
                                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                                <button
                                                    onClick={() => startEdit(t)}
                                                    style={{
                                                        display:      'flex',
                                                        alignItems:   'center',
                                                        gap:          4,
                                                        padding:      '4px 10px',
                                                        background:   'none',
                                                        border:       '1px solid var(--border-default)',
                                                        borderRadius: 'var(--radius-md)',
                                                        color:        'var(--text-muted)',
                                                        fontSize:     'var(--text-xs)',
                                                        cursor:       'pointer',
                                                        fontFamily:   'var(--font-sans)',
                                                    }}
                                                >
                                                    <PencilSimple size={13} />
                                                    Editar
                                                </button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Estilos reutilizables ─────────────────────────────────────────────────────
const labelStyle = {
    display:      'block',
    fontSize:     'var(--text-xs)',
    color:        'var(--text-muted)',
    marginBottom: 4,
    fontWeight:   500,
}

const inputStyle = {
    width:      '100%',
    padding:    'var(--space-3)',
    background: 'var(--bg-surface)',
    border:     '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    color:      'var(--text-primary)',
    fontSize:   'var(--text-sm)',
    fontFamily: 'var(--font-sans)',
    outline:    'none',
    boxSizing:  'border-box',
}