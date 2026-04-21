/**
 * Destello Admin — ChispaList
 * Tabla de chispas con filtros y botón de revocar.
 */
import { useState }         from 'react'
import { XCircle, Funnel }  from '@phosphor-icons/react'

function StatusBadge({ record }) {
    const now = new Date()
    let label, color

    if (record.revoked)                                   { label = 'Revocada';  color = 'var(--color-error)' }
    else if (record.used)                                 { label = 'Usada';     color = '#3b82f6' }
    else if (record.expiresAt && new Date(record.expiresAt) < now) { label = 'Expirada';  color = '#f59e0b' }
    else                                                  { label = 'Activa';    color = '#22c55e' }

    return (
        <span style={{
            display:      'inline-block',
            padding:      '2px 10px',
            borderRadius: 999,
            background:   color + '22',
            color,
            fontSize:     'var(--text-xs)',
            fontWeight:   600,
        }}>
      {label}
    </span>
    )
}

export default function ChispaList({ chispas = [], adminToken, onRevoked }) {
    const [filter,     setFilter]     = useState('all') // 'all' | 'active' | 'used' | 'revoked'
    const [revoking,   setRevoking]   = useState(null)

    const filtered = chispas.filter(c => {
        if (filter === 'active')  return !c.used && !c.revoked
        if (filter === 'used')    return c.used
        if (filter === 'revoked') return c.revoked
        return true
    })

    const handleRevoke = async (code) => {
        if (!confirm(`¿Revocar la chispa ${code}? Esta acción no se puede deshacer.`)) return
        setRevoking(code)
        try {
            const res = await fetch(`/api/admin/chispas/${code}`, {
                method:  'DELETE',
                headers: { 'Authorization': `Bearer ${adminToken}` },
            })
            if (!res.ok) throw new Error('Error al revocar')
            onRevoked?.()
        } catch (err) {
            alert(err.message)
        } finally {
            setRevoking(null)
        }
    }

    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            overflow:     'hidden',
        }}>
            {/* Header con filtros */}
            <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        'var(--space-5) var(--space-6)',
                borderBottom:   '1px solid var(--border-subtle)',
                gap:            'var(--space-3)',
                flexWrap:       'wrap',
            }}>
                <h3 style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Funnel size={18} />
                    Todas las chispas ({filtered.length})
                </h3>

                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    {['all', 'active', 'used', 'revoked'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            style={{
                                padding:      '4px 12px',
                                borderRadius: 999,
                                border:       '1px solid',
                                borderColor:  filter === f ? 'var(--color-jade-500)' : 'var(--border-default)',
                                background:   filter === f ? 'var(--color-jade-500)22' : 'transparent',
                                color:        filter === f ? 'var(--color-jade-500)' : 'var(--text-muted)',
                                fontSize:     'var(--text-xs)',
                                fontWeight:   filter === f ? 600 : 400,
                                cursor:       'pointer',
                                fontFamily:   'var(--font-sans)',
                            }}
                        >
                            {{ all: 'Todas', active: 'Activas', used: 'Usadas', revoked: 'Revocadas' }[f]}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                    <thead>
                    <tr style={{ background: 'var(--bg-surface)' }}>
                        {['Código', 'Taller', 'Vigencia', 'Estado', 'Acción'].map(h => (
                            <th key={h} style={{
                                padding:   'var(--space-3) var(--space-4)',
                                textAlign: 'left',
                                color:     'var(--text-muted)',
                                fontWeight: 500,
                                fontSize:  'var(--text-xs)',
                                whiteSpace: 'nowrap',
                            }}>
                                {h}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {filtered.length === 0 ? (
                        <tr>
                            <td colSpan={5} style={{ padding: 'var(--space-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
                                No hay chispas en este filtro
                            </td>
                        </tr>
                    ) : filtered.map(c => (
                        <tr key={c.code} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                <code style={{ fontWeight: 700, letterSpacing: '0.05em', color: 'var(--color-jade-500)' }}>
                                    {c.code}
                                </code>
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)' }}>
                                {c.tallerId}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                {c.expiresAt
                                    ? new Date(c.expiresAt).toLocaleDateString('es-MX')
                                    : 'Sin límite'}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)', display: 'flex', gap: 6, alignItems: 'center' }}>
                                <StatusBadge record={c} />
                                {c.isDemo && (
                                    <span style={{
                                        display:      'inline-block',
                                        padding:      '2px 8px',
                                        borderRadius: 999,
                                        background:   '#a855f722',
                                        color:        '#a855f7',
                                        fontSize:     'var(--text-xs)',
                                        fontWeight:   600,
                                    }}>🎁 demo</span>
                                )}
                            </td>
                            <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                {!c.revoked && !c.used && (
                                    <button
                                        onClick={() => handleRevoke(c.code)}
                                        disabled={revoking === c.code}
                                        style={{
                                            display:      'flex',
                                            alignItems:   'center',
                                            gap:          4,
                                            padding:      '4px 10px',
                                            background:   'none',
                                            border:       '1px solid var(--color-error)',
                                            borderRadius: 'var(--radius-md)',
                                            color:        'var(--color-error)',
                                            fontSize:     'var(--text-xs)',
                                            cursor:       revoking === c.code ? 'wait' : 'pointer',
                                            fontFamily:   'var(--font-sans)',
                                            opacity:      revoking === c.code ? 0.6 : 1,
                                        }}
                                    >
                                        <XCircle size={14} />
                                        {revoking === c.code ? 'Revocando...' : 'Revocar'}
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}