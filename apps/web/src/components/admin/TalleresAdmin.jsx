/**
 * Destello Admin — TalleresAdmin
 * Gestión de talleres: crear, ver y actualizar desde el panel.
 */
import { useState, useEffect, useCallback } from 'react'
import { Plus, FloppyDisk, PencilSimple, Check, X } from '@phosphor-icons/react'

// Horarios disponibles de 9am a 1pm
const HORARIOS = [
    '9:00 AM',
    '9:30 AM',
    '10:00 AM',
    '10:30 AM',
    '11:00 AM',
    '11:30 AM',
    '12:00 PM',
    '12:30 PM',
    '1:00 PM',
]

const ESTADOS = [
    { value: 'activo',    label: '✅ Activo' },
    { value: 'pausado',   label: '⏸ Pausado' },
    { value: 'borrador',  label: '📝 Borrador' },
]

const emptyForm = {
    nombre:           '',
    descripcion:      '',
    precio:           '',
    horario:          '',
    fecha_disponible: '',
    estado:           'activo',
    categoria:        '',
}

export default function TalleresAdmin({ adminToken, onChanged }) {
    const [talleres,    setTalleres]   = useState([])
    const [loading,     setLoading]    = useState(false)
    const [saving,      setSaving]     = useState(false)
    const [editingId,   setEditingId]  = useState(null)   // id del taller en edición inline
    const [editForm,    setEditForm]   = useState({})     // copia para edición inline
    const [showCreate,  setShowCreate] = useState(false)
    const [createForm,  setCreateForm] = useState(emptyForm)
    const [error,       setError]      = useState(null)
    const [successMsg,  setSuccessMsg] = useState(null)

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }

    const fetchTalleres = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/admin/talleres', { headers })
            const data = await res.json()
            setTalleres(data.talleres ?? [])
        } catch { setTalleres([]) } finally { setLoading(false) }
    }, [adminToken])

    useEffect(() => { fetchTalleres() }, [fetchTalleres])

    const flash = (msg) => {
        setSuccessMsg(msg)
        setTimeout(() => setSuccessMsg(null), 3000)
    }

    // ── Guardar nuevo taller ───────────────────────────────────
    const handleCreate = async (e) => {
        e.preventDefault()
        if (!createForm.nombre.trim()) return
        setSaving(true)
        setError(null)
        try {
            const res = await fetch('/api/admin/talleres', {
                method: 'POST', headers,
                body:   JSON.stringify({
                    ...createForm,
                    precio: Number(createForm.precio) || 0,
                }),
            })
            if (!res.ok) throw new Error('Error creando taller')
            setCreateForm(emptyForm)
            setShowCreate(false)
            await fetchTalleres()
            onChanged?.()
            flash('✅ Taller creado')
        } catch (err) { setError(err.message) } finally { setSaving(false) }
    }

    // ── Edición inline ─────────────────────────────────────────
    const startEdit = (t) => {
        setEditingId(t.id)
        setEditForm({
            nombre:           t.nombre           ?? '',
            descripcion:      t.descripcion      ?? '',
            precio:           t.precio           ?? 0,
            horario:          t.horario          ?? '',
            fecha_disponible: t.fecha_disponible ? t.fecha_disponible.split('T')[0] : '',
            estado:           t.estado           ?? 'activo',
            categoria:        t.categoria        ?? '',
        })
    }

    const cancelEdit = () => { setEditingId(null); setEditForm({}) }

    const saveEdit = async (id) => {
        setSaving(true)
        setError(null)
        try {
            const res = await fetch(`/api/admin/talleres/${id}`, {
                method: 'PUT', headers,
                body:   JSON.stringify({ ...editForm, precio: Number(editForm.precio) || 0 }),
            })
            if (!res.ok) throw new Error('Error guardando')
            setEditingId(null)
            await fetchTalleres()
            onChanged?.()
            flash('✅ Taller actualizado')
        } catch (err) { setError(err.message) } finally { setSaving(false) }
    }

    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            overflow:     'hidden',
        }}>
            {/* Header */}
            <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        'var(--space-5) var(--space-6)',
                borderBottom:   '1px solid var(--border-subtle)',
                gap:            'var(--space-3)',
                flexWrap:       'wrap',
            }}>
                <h3 style={{ fontWeight: 700, margin: 0 }}>📚 Talleres ({talleres.length})</h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {successMsg && (
                        <span style={{ fontSize: 'var(--text-xs)', color: '#22c55e', fontWeight: 600 }}>
                            {successMsg}
                        </span>
                    )}
                    <button
                        onClick={() => setShowCreate(v => !v)}
                        style={btnAddStyle}
                    >
                        <Plus size={14} /> Nuevo taller
                    </button>
                </div>
            </div>

            {/* Formulario crear */}
            {showCreate && (
                <form onSubmit={handleCreate} style={{
                    padding:      'var(--space-5) var(--space-6)',
                    borderBottom: '1px solid var(--border-subtle)',
                    background:   'var(--bg-surface)',
                    display:      'flex',
                    flexDirection:'column',
                    gap:          'var(--space-3)',
                }}>
                    <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)', margin: 0, marginBottom: 4 }}>Nuevo taller</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                        <div>
                            <label style={lblStyle}>Nombre *</label>
                            <input type="text" required placeholder="Ej: Auriculoterapia N1"
                                   value={createForm.nombre}
                                   onChange={e => setCreateForm(f => ({ ...f, nombre: e.target.value }))}
                                   style={inputStyle} />
                        </div>
                        <div>
                            <label style={lblStyle}>Categoría</label>
                            <input type="text" placeholder="Ej: Horizonte Zen"
                                   value={createForm.categoria}
                                   onChange={e => setCreateForm(f => ({ ...f, categoria: e.target.value }))}
                                   style={inputStyle} />
                        </div>
                        <div>
                            <label style={lblStyle}>Precio (MXN)</label>
                            <input type="number" placeholder="0"
                                   value={createForm.precio}
                                   onChange={e => setCreateForm(f => ({ ...f, precio: e.target.value }))}
                                   style={inputStyle} />
                        </div>
                        <div>
                            <label style={lblStyle}>Horario</label>
                            <select value={createForm.horario}
                                    onChange={e => setCreateForm(f => ({ ...f, horario: e.target.value }))}
                                    style={inputStyle}>
                                <option value="">Sin horario</option>
                                {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label style={lblStyle}>Fecha disponible</label>
                            <input type="date"
                                   value={createForm.fecha_disponible}
                                   onChange={e => setCreateForm(f => ({ ...f, fecha_disponible: e.target.value }))}
                                   style={inputStyle} />
                        </div>
                        <div>
                            <label style={lblStyle}>Estado</label>
                            <select value={createForm.estado}
                                    onChange={e => setCreateForm(f => ({ ...f, estado: e.target.value }))}
                                    style={inputStyle}>
                                {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label style={lblStyle}>Descripción</label>
                        <textarea placeholder="Resumen de lo que aprenderán..."
                                  value={createForm.descripcion}
                                  onChange={e => setCreateForm(f => ({ ...f, descripcion: e.target.value }))}
                                  rows={2}
                                  style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 0 }}>{error}</p>}
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button type="submit" disabled={saving} style={btnSaveStyle}>
                            <FloppyDisk size={14} /> {saving ? 'Guardando...' : 'Guardar taller'}
                        </button>
                        <button type="button" onClick={() => setShowCreate(false)} style={btnCancelStyle}>
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            {/* Tabla de talleres */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                    <thead>
                    <tr style={{ background: 'var(--bg-surface)' }}>
                        {['Nombre', 'Horario', 'Fecha', 'Precio', 'Estado', 'Acción'].map(h => (
                            <th key={h} style={{
                                padding: 'var(--space-3) var(--space-4)',
                                textAlign: 'left', color: 'var(--text-muted)',
                                fontWeight: 500, fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
                            }}>{h}</th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {loading && (
                        <tr><td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                            Cargando...
                        </td></tr>
                    )}
                    {!loading && talleres.length === 0 && (
                        <tr><td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No hay talleres. Crea el primero ↑
                        </td></tr>
                    )}
                    {talleres.map(t => {
                        const isEditing = editingId === t.id
                        return (
                            <tr key={t.id} style={{ borderTop: '1px solid var(--border-subtle)', background: isEditing ? 'var(--bg-surface)' : undefined }}>
                                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    {isEditing
                                        ? <input value={editForm.nombre} onChange={e => setEditForm(f => ({ ...f, nombre: e.target.value }))} style={{ ...inputStyle, width: 160 }} />
                                        : <span style={{ fontWeight: 500 }}>{t.nombre}</span>
                                    }
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)' }}>
                                    {isEditing
                                        ? <select value={editForm.horario} onChange={e => setEditForm(f => ({ ...f, horario: e.target.value }))} style={{ ...inputStyle, width: 110 }}>
                                            <option value="">—</option>
                                            {HORARIOS.map(h => <option key={h} value={h}>{h}</option>)}
                                        </select>
                                        : (t.horario || '—')
                                    }
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {isEditing
                                        ? <input type="date" value={editForm.fecha_disponible} onChange={e => setEditForm(f => ({ ...f, fecha_disponible: e.target.value }))} style={{ ...inputStyle, width: 140 }} />
                                        : (t.fecha_disponible ? new Date(t.fecha_disponible).toLocaleDateString('es-MX') : '—')
                                    }
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)' }}>
                                    {isEditing
                                        ? <input type="number" value={editForm.precio} onChange={e => setEditForm(f => ({ ...f, precio: e.target.value }))} style={{ ...inputStyle, width: 80 }} />
                                        : (t.precio > 0 ? `$${t.precio}` : 'Gratis')
                                    }
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    {isEditing
                                        ? <select value={editForm.estado} onChange={e => setEditForm(f => ({ ...f, estado: e.target.value }))} style={{ ...inputStyle, width: 120 }}>
                                            {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                        </select>
                                        : <EstadoBadge estado={t.estado} />
                                    }
                                </td>
                                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    {isEditing ? (
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button onClick={() => saveEdit(t.id)} disabled={saving} style={btnIconGreenStyle} title="Guardar">
                                                <Check size={14} />
                                            </button>
                                            <button onClick={cancelEdit} style={btnIconGrayStyle} title="Cancelar">
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEdit(t)} style={btnIconGrayStyle} title="Editar">
                                            <PencilSimple size={14} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function EstadoBadge({ estado }) {
    const map = { activo: ['#22c55e', 'Activo'], pausado: ['#f59e0b', 'Pausado'], borrador: ['var(--text-muted)', 'Borrador'] }
    const [color, label] = map[estado] ?? ['var(--text-muted)', estado]
    return (
        <span style={{
            display: 'inline-block', padding: '2px 10px',
            borderRadius: 999, background: color + '22',
            color, fontSize: 'var(--text-xs)', fontWeight: 600,
        }}>{label}</span>
    )
}

// ── Estilos ─────────────────────────────────────────────────────────────────
const lblStyle = {
    display: 'block', fontSize: 'var(--text-xs)',
    color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500,
}
const inputStyle = {
    width: '100%', padding: 'var(--space-2) var(--space-3)',
    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    outline: 'none', boxSizing: 'border-box',
}
const btnAddStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '6px 14px', background: 'var(--color-jade-500)',
    border: 'none', borderRadius: 'var(--radius-lg)',
    color: '#fff', fontSize: 'var(--text-xs)', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
}
const btnSaveStyle = {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 16px', background: 'var(--color-jade-500)',
    border: 'none', borderRadius: 'var(--radius-lg)',
    color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600,
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
}
const btnCancelStyle = {
    padding: '8px 16px', background: 'transparent',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
    color: 'var(--text-muted)', fontSize: 'var(--text-sm)',
    cursor: 'pointer', fontFamily: 'var(--font-sans)',
}
const btnIconGreenStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, background: '#22c55e22',
    border: '1px solid #22c55e', borderRadius: 'var(--radius-md)',
    color: '#22c55e', cursor: 'pointer',
}
const btnIconGrayStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    width: 28, height: 28, background: 'transparent',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)', cursor: 'pointer',
}