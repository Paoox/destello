/**
 * Destello Admin — ResplandoresPanel
 * Crear, listar y revocar resplandores (tokens de invitación por email).
 */
import { useState, useCallback } from 'react'
import { Envelope, XCircle, Plus, X, ArrowClockwise, Copy, CheckFat } from '@phosphor-icons/react'

function authHeaders(adminToken) {
    return {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${adminToken}`,
    }
}

const ESTADO_CONFIG = {
    activo:   { label: 'Activo',    color: '#22c55e' },
    usado:    { label: 'Usado',     color: '#3b82f6' },
    expirado: { label: 'Expirado',  color: '#f59e0b' },
    revocado: { label: 'Revocado',  color: 'var(--color-error)' },
}

function getEstado(r) {
    if (r.revoked) return 'revocado'
    if (r.used)    return 'usado'
    if (r.expires_at && new Date(r.expires_at) < new Date()) return 'expirado'
    return 'activo'
}

function EstadoBadge({ record }) {
    const estado = getEstado(record)
    const cfg    = ESTADO_CONFIG[estado]
    return (
        <span style={{
            display: 'inline-block', padding: '2px 10px', borderRadius: 999,
            background: cfg.color + '22', color: cfg.color,
            fontSize: 'var(--text-xs)', fontWeight: 600,
        }}>
            {cfg.label}
        </span>
    )
}

function StatsBar({ stats }) {
    if (!stats) return null
    const items = [
        { label: 'Total',     value: stats.total,     color: 'var(--text-muted)' },
        { label: 'Activos',   value: stats.activos,   color: '#22c55e' },
        { label: 'Usados',    value: stats.usados,    color: '#3b82f6' },
        { label: 'Expirados', value: stats.expirados, color: '#f59e0b' },
        { label: 'Revocados', value: stats.revocados, color: 'var(--color-error)' },
    ]
    return (
        <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)',
            marginBottom: 'var(--space-6)',
        }}>
            {items.map(({ label, value, color }) => (
                <div key={label} style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-5)',
                    textAlign: 'center', minWidth: 90,
                }}>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color }}>{value}</div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                </div>
            ))}
        </div>
    )
}

export default function ResplandoresPanel({ adminToken }) {
    const [resplandores, setResplandores] = useState([])
    const [stats,        setStats]        = useState(null)
    const [loading,      setLoading]      = useState(false)
    const [loaded,       setLoaded]       = useState(false)
    const [revoking,     setRevoking]     = useState(null)
    const [showCreate,   setShowCreate]   = useState(false)
    const [filtro,       setFiltro]       = useState('todos')
    const [copiedCode,   setCopiedCode]   = useState(null)

    // Crear form
    const [formEmail,       setFormEmail]       = useState('')
    const [formNombre,      setFormNombre]       = useState('')
    const [formExpira,      setFormExpira]       = useState(7)
    const [creating,        setCreating]         = useState(false)
    const [createError,     setCreateError]      = useState(null)
    const [createAviso,     setCreateAviso]      = useState(null)
    const [lastResplandor,  setLastResplandor]   = useState(null)

    const fetchData = useCallback(async () => {
        setLoading(true)
        try {
            const [listRes, statsRes] = await Promise.all([
                fetch('/api/admin/resplandores',       { headers: authHeaders(adminToken) }),
                fetch('/api/admin/resplandores/stats', { headers: authHeaders(adminToken) }),
            ])
            const listData  = await listRes.json()
            const statsData = await statsRes.json()
            setResplandores(listData.resplandores ?? [])
            setStats(statsData.stats ?? null)
            setLoaded(true)
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }, [adminToken])

    const handleCreate = async (e) => {
        e.preventDefault()
        if (!formEmail.trim()) return
        setCreating(true)
        setCreateError(null)
        setCreateAviso(null)
        try {
            const res  = await fetch('/api/admin/resplandores', {
                method:  'POST',
                headers: authHeaders(adminToken),
                body:    JSON.stringify({
                    email:         formEmail.trim().toLowerCase(),
                    nombre:        formNombre.trim() || undefined,
                    expiresInDays: formExpira,
                }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message ?? 'Error al crear')
            setLastResplandor(data.resplandor)
            if (data.aviso) setCreateAviso(data.aviso)
            setFormEmail('')
            setFormNombre('')
            // Refresh lista si ya estaba cargada
            if (loaded) fetchData()
        } catch (err) {
            setCreateError(err.message)
        } finally {
            setCreating(false)
        }
    }

    const handleRevoke = async (code) => {
        if (!confirm(`¿Revocar el resplandor ${code}?`)) return
        setRevoking(code)
        try {
            const res = await fetch(`/api/admin/resplandores/${code}`, {
                method:  'DELETE',
                headers: authHeaders(adminToken),
            })
            if (!res.ok) throw new Error('Error al revocar')
            setResplandores(prev => prev.map(r => r.code === code ? { ...r, revoked: true } : r))
            if (stats) setStats(prev => ({ ...prev, activos: prev.activos - 1, revocados: prev.revocados + 1 }))
        } catch (err) {
            alert(err.message)
        } finally {
            setRevoking(null)
        }
    }

    const handleCopy = (code) => {
        navigator.clipboard.writeText(code)
        setCopiedCode(code)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    const filtered = resplandores.filter(r => {
        if (filtro === 'activos')   return getEstado(r) === 'activo'
        if (filtro === 'usados')    return r.used
        if (filtro === 'revocados') return r.revoked
        return true
    })

    return (
        <div>
            {/* Header */}
            <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Envelope size={22} color="var(--color-jade-500)" weight="fill" />
                    <h2 style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Resplandores</h2>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                        onClick={() => { setShowCreate(v => !v); setLastResplandor(null); setCreateError(null); setCreateAviso(null) }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: 'var(--space-2) var(--space-4)',
                            background: showCreate ? 'var(--bg-surface)' : 'var(--color-jade-500)',
                            border: '1px solid var(--color-jade-500)', borderRadius: 'var(--radius-lg)',
                            color: showCreate ? 'var(--color-jade-500)' : 'var(--text-primary)',
                            fontSize: 'var(--text-xs)', fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                    >
                        {showCreate ? <X size={14} /> : <Plus size={14} />}
                        {showCreate ? 'Cancelar' : 'Nuevo resplandor'}
                    </button>
                    <button
                        onClick={fetchData} disabled={loading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: 'var(--space-2) var(--space-4)',
                            background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                            borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)',
                            fontSize: 'var(--text-xs)', fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
                            fontFamily: 'var(--font-sans)',
                        }}
                    >
                        <ArrowClockwise size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
                        {loaded ? 'Actualizar' : 'Cargar'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <StatsBar stats={stats} />

            {/* Formulario crear */}
            {showCreate && (
                <div style={{
                    marginBottom: 'var(--space-6)',
                    background: 'var(--bg-card)', border: '1px solid var(--color-jade-500)44',
                    borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)',
                }}>
                    <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-4)', fontSize: 'var(--text-base)' }}>
                        ✦ Crear resplandor
                    </h3>

                    {lastResplandor ? (
                        /* Resultado */
                        <div style={{ textAlign: 'center' }}>
                            {createAviso && (
                                <p style={{ color: '#f59e0b', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>
                                    {createAviso}
                                </p>
                            )}
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
                                Código generado para <strong>{lastResplandor.email}</strong>
                            </p>
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)',
                                padding: 'var(--space-4)', background: 'var(--bg-surface)',
                                borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-jade-500)44',
                                marginBottom: 'var(--space-4)',
                            }}>
                                <code style={{
                                    fontSize: 'var(--text-xl)', fontWeight: 700,
                                    letterSpacing: '0.08em', color: 'var(--color-jade-500)',
                                }}>
                                    {lastResplandor.code}
                                </code>
                                <button onClick={() => handleCopy(lastResplandor.code)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                                    {copiedCode === lastResplandor.code ? <CheckFat size={18} color="#22c55e" /> : <Copy size={18} />}
                                </button>
                            </div>
                            <button
                                onClick={() => { setLastResplandor(null); setCreateAviso(null) }}
                                style={{
                                    padding: 'var(--space-2) var(--space-5)',
                                    background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-lg)', color: 'var(--text-muted)',
                                    fontSize: 'var(--text-xs)', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                }}
                            >
                                Crear otro
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleCreate}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                                <div>
                                    <label style={labelStyle}>Email *</label>
                                    <input type="email" placeholder="usuario@correo.com" required
                                           value={formEmail} onChange={e => setFormEmail(e.target.value)}
                                           style={inputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Nombre (opcional)</label>
                                    <input type="text" placeholder="Nombre del usuario"
                                           value={formNombre} onChange={e => setFormNombre(e.target.value)}
                                           style={inputStyle} />
                                </div>
                            </div>
                            <div style={{ marginBottom: 'var(--space-4)', maxWidth: 200 }}>
                                <label style={labelStyle}>Vigencia (días para aceptar)</label>
                                <select value={formExpira} onChange={e => setFormExpira(Number(e.target.value))} style={inputStyle}>
                                    <option value={3}>3 días</option>
                                    <option value={7}>7 días</option>
                                    <option value={15}>15 días</option>
                                    <option value={30}>30 días</option>
                                </select>
                            </div>
                            {createError && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>{createError}</p>}
                            <button type="submit" disabled={creating || !formEmail.trim()}
                                    style={{
                                        padding: 'var(--space-3) var(--space-6)',
                                        background: creating || !formEmail.trim() ? 'var(--bg-surface)' : 'var(--color-jade-500)',
                                        border: '1px solid transparent', borderRadius: 'var(--radius-lg)',
                                        color: creating || !formEmail.trim() ? 'var(--text-muted)' : 'var(--text-primary)',
                                        fontWeight: 600, fontSize: 'var(--text-sm)', cursor: creating || !formEmail.trim() ? 'not-allowed' : 'pointer',
                                        fontFamily: 'var(--font-sans)',
                                    }}
                            >
                                {creating ? 'Generando...' : '✦ Generar resplandor'}
                            </button>
                        </form>
                    )}
                </div>
            )}

            {/* Filtros */}
            {loaded && (
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
                    {['todos', 'activos', 'usados', 'revocados'].map(f => (
                        <button key={f} onClick={() => setFiltro(f)} style={{
                            padding: '4px 12px', borderRadius: 999,
                            border: '1px solid', fontFamily: 'var(--font-sans)',
                            borderColor: filtro === f ? 'var(--color-jade-500)' : 'var(--border-default)',
                            background:  filtro === f ? 'var(--color-jade-500)22' : 'transparent',
                            color:       filtro === f ? 'var(--color-jade-500)' : 'var(--text-muted)',
                            fontSize: 'var(--text-xs)', fontWeight: filtro === f ? 600 : 400, cursor: 'pointer',
                            textTransform: 'capitalize',
                        }}>
                            {f}
                        </button>
                    ))}
                </div>
            )}

            {/* Lista */}
            {!loaded && !loading && (
                <div style={{
                    textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)',
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)', fontSize: 'var(--text-sm)',
                }}>
                    <Envelope size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                    <p>Haz clic en "Cargar" para ver los resplandores</p>
                </div>
            )}

            {loaded && (
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-xl)', overflow: 'hidden',
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                            <thead>
                            <tr style={{ background: 'var(--bg-surface)' }}>
                                {['Código', 'Email', 'Nombre', 'Expira', 'Estado', 'Acción'].map(h => (
                                    <th key={h} style={{
                                        padding: 'var(--space-3) var(--space-4)', textAlign: 'left',
                                        color: 'var(--text-muted)', fontWeight: 500, fontSize: 'var(--text-xs)', whiteSpace: 'nowrap',
                                    }}>{h}</th>
                                ))}
                            </tr>
                            </thead>
                            <tbody>
                            {filtered.length === 0 ? (
                                <tr><td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                    No hay resplandores en este filtro
                                </td></tr>
                            ) : filtered.map(r => (
                                <tr key={r.code} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <code style={{ fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-jade-500)', fontSize: 'var(--text-xs)' }}>
                                                {r.code}
                                            </code>
                                            <button onClick={() => handleCopy(r.code)}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
                                                {copiedCode === r.code ? <CheckFat size={12} color="#22c55e" /> : <Copy size={12} />}
                                            </button>
                                        </div>
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                                        {r.email}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)' }}>
                                        {r.nombre || <span style={{ opacity: 0.4 }}>—</span>}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                                        {r.expires_at
                                            ? new Date(r.expires_at).toLocaleDateString('es-MX')
                                            : <span style={{ opacity: 0.4 }}>Sin límite</span>}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        <EstadoBadge record={r} />
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        {getEstado(r) === 'activo' && (
                                            <button
                                                onClick={() => handleRevoke(r.code)}
                                                disabled={revoking === r.code}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 4,
                                                    padding: '4px 10px',
                                                    background: 'none', border: '1px solid var(--color-error)',
                                                    borderRadius: 'var(--radius-md)', color: 'var(--color-error)',
                                                    fontSize: 'var(--text-xs)', cursor: revoking === r.code ? 'wait' : 'pointer',
                                                    fontFamily: 'var(--font-sans)', opacity: revoking === r.code ? 0.6 : 1,
                                                }}
                                            >
                                                <XCircle size={13} />
                                                {revoking === r.code ? 'Revocando...' : 'Revocar'}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
    )
}

const labelStyle = { display: 'block', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500 }
const inputStyle = {
    width: '100%', padding: 'var(--space-3)', background: 'var(--bg-surface)',
    border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)',
    color: 'var(--text-primary)', fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
    outline: 'none', boxSizing: 'border-box',
}