/**
 * Destello Admin — ListaEsperaAdmin
 * Tabla de lista de espera con actualización de estado y acceso rápido a WA/correo.
 */
import { useState, useEffect, useCallback } from 'react'
import { WhatsappLogo, Envelope, ArrowClockwise } from '@phosphor-icons/react'

const ESTADOS_OPTS = [
    { value: 'pendiente',  label: '⏳ Pendiente',  color: '#f59e0b' },
    { value: 'confirmado', label: '✅ Confirmado',  color: '#22c55e' },
    { value: 'rechazado',  label: '❌ Rechazado',   color: 'var(--color-error)' },
]

function EstadoSelect({ value, onChange, disabled }) {
    const opt = ESTADOS_OPTS.find(o => o.value === value)
    return (
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            style={{
                padding:      '3px 8px',
                background:   (opt?.color ?? 'var(--text-muted)') + '22',
                border:       `1px solid ${opt?.color ?? 'var(--border-default)'}`,
                borderRadius: 999,
                color:        opt?.color ?? 'var(--text-muted)',
                fontSize:     'var(--text-xs)',
                fontWeight:   600,
                cursor:       disabled ? 'default' : 'pointer',
                fontFamily:   'var(--font-sans)',
                outline:      'none',
            }}
        >
            {ESTADOS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    )
}

export default function ListaEsperaAdmin({ adminToken }) {
    const [lista,      setLista]      = useState([])
    const [loading,    setLoading]    = useState(false)
    const [updating,   setUpdating]   = useState(null)
    const [filterEstado, setFilterEstado] = useState('all')

    const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` }

    const fetchLista = useCallback(async () => {
        setLoading(true)
        try {
            const res  = await fetch('/api/admin/lista-espera', { headers })
            const data = await res.json()
            setLista(data.lista ?? [])
        } catch { setLista([]) } finally { setLoading(false) }
    }, [adminToken])

    useEffect(() => { fetchLista() }, [fetchLista])

    const updateEstado = async (id, nuevoEstado) => {
        setUpdating(id)
        try {
            await fetch(`/api/admin/lista-espera/${id}`, {
                method: 'PATCH', headers,
                body:   JSON.stringify({ estado: nuevoEstado }),
            })
            setLista(prev => prev.map(r => r.id === id ? { ...r, estado: nuevoEstado } : r))
        } catch { /* ignorar */ } finally { setUpdating(null) }
    }

    const filtered = lista.filter(r => filterEstado === 'all' || r.estado === filterEstado)

    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            overflow:     'hidden',
        }}>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: 'var(--space-5) var(--space-6)',
                borderBottom: '1px solid var(--border-subtle)',
                gap: 'var(--space-3)', flexWrap: 'wrap',
            }}>
                <h3 style={{ fontWeight: 700, margin: 0 }}>⏳ Lista de espera ({filtered.length})</h3>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Filtro por estado */}
                    {['all', 'pendiente', 'confirmado', 'rechazado'].map(f => (
                        <button key={f} onClick={() => setFilterEstado(f)} style={{
                            padding: '4px 12px', borderRadius: 999, border: '1px solid',
                            borderColor: filterEstado === f ? 'var(--color-jade-500)' : 'var(--border-default)',
                            background: filterEstado === f ? 'var(--color-jade-500)22' : 'transparent',
                            color: filterEstado === f ? 'var(--color-jade-500)' : 'var(--text-muted)',
                            fontSize: 'var(--text-xs)', fontWeight: filterEstado === f ? 600 : 400,
                            cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}>
                            {{ all: 'Todos', pendiente: 'Pendientes', confirmado: 'Confirmados', rechazado: 'Rechazados' }[f]}
                        </button>
                    ))}
                    <button onClick={fetchLista} disabled={loading} style={{
                        display: 'flex', alignItems: 'center', padding: 'var(--space-2)',
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)', cursor: 'pointer',
                    }}>
                        <ArrowClockwise size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                    </button>
                </div>
            </div>

            {/* Tabla */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                    <thead>
                    <tr style={{ background: 'var(--bg-surface)' }}>
                        {['Nombre', 'Correo', 'Taller', 'Fecha', 'Estado', 'Contacto'].map(h => (
                            <th key={h} style={{
                                padding: 'var(--space-3) var(--space-4)', textAlign: 'left',
                                color: 'var(--text-muted)', fontWeight: 500,
                                fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
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
                    {!loading && filtered.length === 0 && (
                        <tr><td colSpan={6} style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No hay registros en este filtro
                        </td></tr>
                    )}
                    {filtered.map(r => (
                        <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>
                                {r.nombre || <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>—</span>}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                {r.email}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', maxWidth: 160 }}>
                                    <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {r.taller_nombre || r.taller_id}
                                    </span>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                                {r.created_at ? new Date(r.created_at).toLocaleDateString('es-MX') : '—'}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                <EstadoSelect
                                    value={r.estado ?? 'pendiente'}
                                    onChange={val => updateEstado(r.id, val)}
                                    disabled={updating === r.id}
                                />
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {/* WhatsApp */}
                                    {r.whatsapp && (
                                        <a
                                            href={`https://wa.me/52${r.whatsapp}`}
                                            target="_blank" rel="noreferrer"
                                            title={`WhatsApp ${r.whatsapp}`}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: 28, height: 28,
                                                background: '#25D36622', border: '1px solid #25D366',
                                                borderRadius: 'var(--radius-md)',
                                                color: '#25D366', textDecoration: 'none',
                                            }}
                                        >
                                            <WhatsappLogo size={14} weight="fill" />
                                        </a>
                                    )}
                                    {/* Correo */}
                                    {r.email && (
                                        <a
                                            href={`mailto:${r.email}`}
                                            title={`Enviar correo a ${r.email}`}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: 28, height: 28,
                                                background: 'var(--color-jade-500)22', border: '1px solid var(--color-jade-500)',
                                                borderRadius: 'var(--radius-md)',
                                                color: 'var(--color-jade-500)', textDecoration: 'none',
                                            }}
                                        >
                                            <Envelope size={14} weight="fill" />
                                        </a>
                                    )}
                                </div>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}