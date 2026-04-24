/**
 * Destello Admin — ChispaList
 * Lista completa de chispas con filtros por estado y botón de revocar.
 * Props:
 *   chispas     — array de ChispaRecord (jalado desde PageAdmin)
 *   adminToken  — JWT del admin para revocar
 *   onRevoked   — callback para refrescar datos en PageAdmin
 */
import { useState } from 'react'
import { XCircle, Copy, CheckFat, MagnifyingGlass } from '@phosphor-icons/react'
import { apiRevokeChispa } from '@services/adminApi.js'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getEstado(c) {
    if (c.revoked) return 'revocada'
    if (c.used)    return 'usada'
    const now = new Date()
    if (c.expiresAt && new Date(c.expiresAt) <= now) return 'expirada'
    return 'activa'
}

const ESTADO_CFG = {
    activa:   { color: '#22c55e',           label: 'Activa'   },
    usada:    { color: '#3b82f6',           label: 'Usada'    },
    expirada: { color: '#f59e0b',           label: 'Expirada' },
    revocada: { color: 'var(--color-error)', label: 'Revocada' },
}

function EstadoBadge({ chispa }) {
    const estado = getEstado(chispa)
    const { color, label } = ESTADO_CFG[estado]
    return (
        <span style={{
            display:      'inline-block',
            padding:      '2px 10px',
            borderRadius: 999,
            background:   color + '22',
            color,
            fontSize:     'var(--text-xs)',
            fontWeight:   600,
            whiteSpace:   'nowrap',
        }}>
            {label}
        </span>
    )
}

function formatFecha(date) {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Componente principal ───────────────────────────────────────────────────────

const FILTROS = [
    { id: 'todas',    label: 'Todas'    },
    { id: 'activa',   label: 'Activas'  },
    { id: 'usada',    label: 'Usadas'   },
    { id: 'expirada', label: 'Expiradas'},
    { id: 'revocada', label: 'Revocadas'},
]

export default function ChispaList({ chispas = [], adminToken, onRevoked }) {
    const [filtro,     setFiltro]    = useState('todas')
    const [search,     setSearch]    = useState('')
    const [revoking,   setRevoking]  = useState(null)   // code en proceso
    const [copiedCode, setCopied]    = useState(null)

    // Filtrar
    const visible = chispas.filter(c => {
        if (filtro !== 'todas' && getEstado(c) !== filtro) return false
        if (search.trim()) {
            const q = search.trim().toLowerCase()
            return (
                c.code?.toLowerCase().includes(q) ||
                c.usuarioNombre?.toLowerCase().includes(q) ||
                c.usuarioEmail?.toLowerCase().includes(q) ||
                c.tallerNombre?.toLowerCase().includes(q)
            )
        }
        return true
    })

    const handleRevoke = async (code) => {
        if (!confirm(`¿Revocar la chispa ${code}? Esta acción no se puede deshacer.`)) return
        setRevoking(code)
        try {
            await apiRevokeChispa(adminToken, code)
            onRevoked?.()
        } catch (err) {
            alert('Error al revocar: ' + err.message)
        } finally {
            setRevoking(null)
        }
    }

    const handleCopy = (code) => {
        navigator.clipboard.writeText(code)
        setCopied(code)
        setTimeout(() => setCopied(null), 2000)
    }

    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            overflow:     'hidden',
        }}>
            {/* Header con filtros y buscador */}
            <div style={{
                padding:       'var(--space-4) var(--space-5)',
                borderBottom:  '1px solid var(--border-subtle)',
                display:       'flex',
                flexDirection: 'column',
                gap:           'var(--space-3)',
            }}>
                {/* Fila 1: título + contador */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                        Lista de chispas
                    </span>
                    <span style={{
                        fontSize:     'var(--text-xs)',
                        color:        'var(--text-muted)',
                        background:   'var(--bg-surface)',
                        border:       '1px solid var(--border-default)',
                        borderRadius: 999,
                        padding:      '2px 10px',
                    }}>
                        {visible.length} de {chispas.length}
                    </span>
                </div>

                {/* Fila 2: tabs de filtro */}
                <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
                    {FILTROS.map(f => {
                        const count = f.id === 'todas'
                            ? chispas.length
                            : chispas.filter(c => getEstado(c) === f.id).length
                        return (
                            <button
                                key={f.id}
                                onClick={() => setFiltro(f.id)}
                                style={{
                                    padding:      '3px 10px',
                                    borderRadius: 999,
                                    border:       '1px solid',
                                    borderColor:  filtro === f.id ? 'var(--color-jade-500)' : 'var(--border-default)',
                                    background:   filtro === f.id ? 'var(--color-jade-500)22' : 'transparent',
                                    color:        filtro === f.id ? 'var(--color-jade-500)' : 'var(--text-muted)',
                                    fontSize:     'var(--text-xs)',
                                    fontWeight:   filtro === f.id ? 600 : 400,
                                    cursor:       'pointer',
                                    fontFamily:   'var(--font-sans)',
                                    whiteSpace:   'nowrap',
                                }}
                            >
                                {f.label}{count > 0 ? ` (${count})` : ''}
                            </button>
                        )
                    })}
                </div>

                {/* Fila 3: buscador */}
                <div style={{ position: 'relative' }}>
                    <MagnifyingGlass
                        size={14}
                        style={{
                            position:      'absolute',
                            left:          10,
                            top:           '50%',
                            transform:     'translateY(-50%)',
                            color:         'var(--text-muted)',
                            pointerEvents: 'none',
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Buscar por código, usuario, taller..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        style={{
                            width:         '100%',
                            paddingLeft:   30,
                            paddingRight:  'var(--space-3)',
                            paddingTop:    'var(--space-2)',
                            paddingBottom: 'var(--space-2)',
                            background:    'var(--bg-surface)',
                            border:        '1px solid var(--border-default)',
                            borderRadius:  'var(--radius-lg)',
                            color:         'var(--text-primary)',
                            fontSize:      'var(--text-sm)',
                            fontFamily:    'var(--font-sans)',
                            outline:       'none',
                            boxSizing:     'border-box',
                        }}
                    />
                </div>
            </div>

            {/* Tabla */}
            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
                    <thead>
                    <tr style={{ background: 'var(--bg-surface)' }}>
                        {['Código', 'Usuario', 'Taller', 'Vigencia', 'Estado', ''].map(h => (
                            <th key={h} style={{
                                padding:    'var(--space-3) var(--space-4)',
                                textAlign:  'left',
                                color:      'var(--text-muted)',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                            }}>
                                {h}
                            </th>
                        ))}
                    </tr>
                    </thead>
                    <tbody>
                    {visible.length === 0 && (
                        <tr>
                            <td colSpan={6} style={{
                                padding:   'var(--space-10)',
                                textAlign: 'center',
                                color:     'var(--text-muted)',
                            }}>
                                {chispas.length === 0
                                    ? 'Aún no hay chispas generadas'
                                    : 'No hay chispas con este filtro'
                                }
                            </td>
                        </tr>
                    )}
                    {visible.map(c => {
                        const estado   = getEstado(c)
                        const isActive = estado === 'activa'
                        return (
                            <tr key={c.code} style={{ borderTop: '1px solid var(--border-subtle)' }}>

                                {/* Código */}
                                <td style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <code style={{
                                            fontWeight:    700,
                                            letterSpacing: '0.05em',
                                            color:         'var(--color-jade-500)',
                                        }}>
                                            {c.code}
                                        </code>
                                        <button
                                            onClick={() => handleCopy(c.code)}
                                            title="Copiar código"
                                            style={{
                                                background: 'none', border: 'none',
                                                cursor: 'pointer', color: 'var(--text-muted)', padding: 2,
                                            }}
                                        >
                                            {copiedCode === c.code
                                                ? <CheckFat size={12} color="#22c55e" />
                                                : <Copy size={12} />
                                            }
                                        </button>
                                        {c.isDemo && (
                                            <span style={{
                                                fontSize:     'var(--text-xs)',
                                                color:        '#D97706',
                                                background:   '#D9770622',
                                                border:       '1px solid #D97706',
                                                borderRadius: 999,
                                                padding:      '0px 6px',
                                                fontWeight:   600,
                                            }}>
                                                demo
                                            </span>
                                        )}
                                    </div>
                                </td>

                                {/* Usuario */}
                                <td style={{ padding: 'var(--space-3) var(--space-4)', maxWidth: 160 }}>
                                    {c.usuarioNombre || c.usuarioEmail ? (
                                        <div>
                                            {c.usuarioNombre && (
                                                <p style={{
                                                    fontWeight: 600, margin: 0,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {c.usuarioNombre}
                                                </p>
                                            )}
                                            {c.usuarioEmail && (
                                                <p style={{
                                                    color: 'var(--text-muted)', margin: 0,
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {c.usuarioEmail}
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic' }}>
                                            Sin asignar
                                        </span>
                                    )}
                                </td>

                                {/* Taller */}
                                <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', maxWidth: 140 }}>
                                    <span style={{
                                        display: 'block', overflow: 'hidden',
                                        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {c.tallerNombre || c.tallerId || '—'}
                                    </span>
                                </td>

                                {/* Vigencia */}
                                <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                    {c.expiresAt
                                        ? formatFecha(c.expiresAt)
                                        : <span style={{ opacity: 0.5 }}>Sin límite</span>
                                    }
                                </td>

                                {/* Estado */}
                                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    <EstadoBadge chispa={c} />
                                </td>

                                {/* Acción */}
                                <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                    {isActive && (
                                        <button
                                            onClick={() => handleRevoke(c.code)}
                                            disabled={revoking === c.code}
                                            title="Revocar chispa"
                                            style={{
                                                display:      'flex',
                                                alignItems:   'center',
                                                gap:          4,
                                                padding:      '3px 10px',
                                                background:   'none',
                                                border:       '1px solid var(--color-error)',
                                                borderRadius: 'var(--radius-md)',
                                                color:        'var(--color-error)',
                                                fontSize:     'var(--text-xs)',
                                                fontWeight:   600,
                                                cursor:       revoking === c.code ? 'wait' : 'pointer',
                                                fontFamily:   'var(--font-sans)',
                                                opacity:      revoking === c.code ? 0.5 : 1,
                                                whiteSpace:   'nowrap',
                                            }}
                                        >
                                            <XCircle size={12} />
                                            {revoking === c.code ? 'Revocando...' : 'Revocar'}
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