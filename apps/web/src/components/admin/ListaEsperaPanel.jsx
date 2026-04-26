/**
 * Destello Admin — ListaEsperaPanel
 * Tabla de personas en lista de espera, agrupadas por taller.
 * Permite confirmar cupo → genera chispa automáticamente.
 */
import { useState, useEffect, useCallback } from 'react'
import { UserList, CheckCircle, Copy, CheckFat, Clock, X, ChartBar, Sparkle, Lightning, EnvelopeSimple } from '@phosphor-icons/react'
import { apiListEspera, apiConfirmarCupo, apiConfirmarLugar, apiGetTalleresStats } from '@services/adminApi.js'

const ESTADO_CONFIG = {
    pendiente:   { label: 'Pendiente',   color: '#f59e0b' },
    confirmado:  { label: 'Confirmado',  color: '#22c55e' },
    cancelado:   { label: 'Cancelado',   color: 'var(--color-error)' },
}

function EstadoBadge({ estado }) {
    const cfg = ESTADO_CONFIG[estado] ?? { label: estado, color: 'var(--text-muted)' }
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

function TokenResultModal({ token, onClose }) {
    const [copied, setCopied] = useState(false)
    const esChispa = token.tipo === 'chispa'
    const color    = esChispa ? '#f59e0b' : 'var(--color-jade-500)'

    const handleCopy = () => {
        navigator.clipboard.writeText(token.code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <div style={{
            position:       'fixed',
            inset:          0,
            background:     'rgba(0,0,0,0.6)',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            zIndex:         1000,
        }}>
            <div style={{
                background:   'var(--bg-card)',
                border:       `1px solid ${color}44`,
                borderRadius: 'var(--radius-xl)',
                padding:      'var(--space-8)',
                maxWidth:     420,
                width:        '90%',
                textAlign:    'center',
                position:     'relative',
            }}>
                <button onClick={onClose} style={{ position: 'absolute', top: 'var(--space-3)', right: 'var(--space-3)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 'var(--space-1)' }}>
                    <X size={18} />
                </button>

                {esChispa
                    ? <Lightning size={40} weight="fill" color={color} style={{ marginBottom: 'var(--space-3)' }} />
                    : <Sparkle   size={40} weight="fill" color={color} style={{ marginBottom: 'var(--space-3)' }} />
                }

                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                    {esChispa ? '¡Chispa generada!' : '¡Resplandor generado!'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-5)' }}>
                    {esChispa
                        ? 'Copia la chispa y envíasela al usuario para acceder al taller.'
                        : 'Copia el resplandor y envíaselo al usuario para crear su cuenta.'
                    }
                </p>

                <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    gap:            'var(--space-3)',
                    padding:        'var(--space-4)',
                    background:     'var(--bg-surface)',
                    borderRadius:   'var(--radius-lg)',
                    border:         '1px solid var(--border-default)',
                    marginBottom:   'var(--space-5)',
                }}>
                    <code style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '0.08em', color }}>
                        {token.code}
                    </code>
                    <button onClick={handleCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                        {copied ? <CheckFat size={20} color="#22c55e" /> : <Copy size={20} />}
                    </button>
                </div>

                <button onClick={onClose} style={{ padding: 'var(--space-3) var(--space-6)', background: color, border: 'none', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 'var(--text-sm)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    Listo
                </button>
            </div>
        </div>
    )
}

// ── Resumen de demanda por taller ─────────────────────────────────────────────
function ResumenDemanda({ talStats }) {
    if (!talStats || talStats.length === 0) return null
    // Solo mostrar talleres con al menos 1 persona en espera
    const conEspera = talStats.filter(s => Number(s.total_espera) > 0)
    if (conEspera.length === 0) return null

    return (
        <div style={{
            background:   'var(--bg-card)',
            border:       '1px solid var(--border-default)',
            borderRadius: 'var(--radius-xl)',
            padding:      'var(--space-4) var(--space-5)',
            marginBottom: 'var(--space-5)',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
                <ChartBar size={16} color="var(--color-jade-500)" weight="fill" />
                <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>Resumen por taller</span>
            </div>
            <div style={{
                display:             'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap:                 'var(--space-3)',
            }}>
                {conEspera.map(s => {
                    const pendientes  = Number(s.pendientes)
                    const confirmados = Number(s.confirmados)
                    const total       = Number(s.total_espera)
                    return (
                        <div key={s.id} style={{
                            background:   'var(--bg-surface)',
                            borderRadius: 'var(--radius-lg)',
                            padding:      'var(--space-3) var(--space-4)',
                            border:       '1px solid var(--border-subtle)',
                        }}>
                            <p style={{
                                fontSize:     'var(--text-xs)',
                                fontWeight:   600,
                                marginBottom: 'var(--space-2)',
                                overflow:     'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace:   'nowrap',
                            }}>
                                {s.nombre}
                            </p>
                            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                                <span style={{
                                    display:      'inline-flex',
                                    alignItems:   'center',
                                    gap:          4,
                                    fontSize:     'var(--text-xs)',
                                    color:        'var(--text-muted)',
                                }}>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--text-base)' }}>
                                        {total}
                                    </span>
                                    total
                                </span>
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
                                {confirmados > 0 && (
                                    <span style={{
                                        fontSize:    'var(--text-xs)',
                                        color:       '#22c55e',
                                        background:  '#22c55e22',
                                        padding:     '1px 7px',
                                        borderRadius: 999,
                                        fontWeight:  600,
                                    }}>
                                        {confirmados} confirmado{confirmados !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

export default function ListaEsperaPanel({ adminToken }) {
    const [lista,        setLista]        = useState([])
    const [talStats,     setTalStats]     = useState([])
    const [loading,      setLoading]      = useState(false)
    const [loaded,       setLoaded]       = useState(false)
    const [error,        setError]        = useState(null)
    const [confirming,   setConfirming]   = useState(null)   // id confirmando lugar
    const [generating,   setGenerating]   = useState(null)   // id generando código
    const [lastToken,    setLastToken]    = useState(null)   // { code, tipo } para modal
    const [filtroEstado, setFiltroEstado] = useState('todos')

    const fetchLista = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [listaData, statsData] = await Promise.all([
                apiListEspera(adminToken),
                apiGetTalleresStats(adminToken),
            ])
            setLista(listaData.lista)
            setTalStats(statsData.stats)
            setLoaded(true)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [adminToken])

    // Carga automática al montar el componente (al entrar al tab)
    useEffect(() => { fetchLista() }, [fetchLista])

    const refreshData = async () => {
        const [fresh, statsData] = await Promise.all([
            apiListEspera(adminToken),
            apiGetTalleresStats(adminToken),
        ])
        setLista(fresh.lista)
        setTalStats(statsData.stats)
    }

    // Botón 1: solo confirmar el lugar (sin código)
    const handleConfirmarLugar = async (registro) => {
        if (!confirm(`¿Confirmar lugar para ${registro.nombre || registro.email}?\nSe le enviará un email con los detalles del taller y formas de pago.`)) return
        setConfirming(registro.id)
        try {
            await apiConfirmarLugar(adminToken, registro.id)
            await refreshData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setConfirming(null)
        }
    }

    // Botón 2: generar código de acceso (resplandor o chispa según tiene_resplandor)
    const handleGenerarAcceso = async (registro) => {
        const tipo   = registro.tiene_resplandor ? 'chispa' : 'resplandor'
        const nombre = registro.nombre || registro.email
        const accion = tipo === 'chispa' ? 'Chispa de taller' : 'Resplandor de cuenta'
        if (!confirm(`¿Generar ${accion} para ${nombre}?\nSe enviará el código por email y WhatsApp.`)) return
        setGenerating(registro.id)
        try {
            const data = await apiConfirmarCupo(adminToken, registro.id, { tipo, expiresInDays: 30 })
            const code = data.chispa?.code ?? data.resplandor?.code
            setLastToken({ code, tipo })
            await refreshData()
        } catch (err) {
            alert('Error: ' + err.message)
        } finally {
            setGenerating(null)
        }
    }

    // Agrupar por taller
    const filtered = filtroEstado === 'todos'
        ? lista
        : lista.filter(r => r.estado === filtroEstado)

    const porTaller = filtered.reduce((acc, r) => {
        const key = r.taller_nombre || r.taller_id || 'Sin taller'
        if (!acc[key]) acc[key] = []
        acc[key].push(r)
        return acc
    }, {})

    const totalPendientes = lista.filter(r => r.estado === 'pendiente').length

    return (
        <div>
            {/* Header panel */}
            <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                marginBottom:   'var(--space-5)',
                flexWrap:       'wrap',
                gap:            'var(--space-3)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <UserList size={22} color="var(--color-jade-500)" weight="fill" />
                    <div>
                        <h2 style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>Lista de espera</h2>
                        {totalPendientes > 0 && (
                            <p style={{ fontSize: 'var(--text-xs)', color: '#f59e0b', marginTop: 2 }}>
                                {totalPendientes} pendiente{totalPendientes !== 1 ? 's' : ''} por confirmar
                            </p>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                    {/* Filtro */}
                    {['todos', 'pendiente', 'confirmado', 'cancelado'].map(f => (
                        <button
                            key={f}
                            onClick={() => setFiltroEstado(f)}
                            style={{
                                padding:      '4px 12px',
                                borderRadius: 999,
                                border:       '1px solid',
                                borderColor:  filtroEstado === f ? 'var(--color-jade-500)' : 'var(--border-default)',
                                background:   filtroEstado === f ? 'var(--color-jade-500)22' : 'transparent',
                                color:        filtroEstado === f ? 'var(--color-jade-500)' : 'var(--text-muted)',
                                fontSize:     'var(--text-xs)',
                                fontWeight:   filtroEstado === f ? 600 : 400,
                                cursor:       'pointer',
                                fontFamily:   'var(--font-sans)',
                                textTransform: 'capitalize',
                            }}
                        >
                            {f === 'todos' ? 'Todos' : f}
                        </button>
                    ))}

                    <button
                        onClick={fetchLista}
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
                        {loading ? 'Cargando...' : loaded ? '↺ Actualizar' : 'Cargar lista'}
                    </button>
                </div>
            </div>

            {/* Resumen por taller */}
            {loaded && <ResumenDemanda talStats={talStats} />}

            {error && (
                <div style={{ color: 'var(--color-error)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-4)' }}>
                    Error: {error}
                </div>
            )}

            {!loaded && !loading && (
                <div style={{
                    textAlign:  'center',
                    padding:    'var(--space-16)',
                    color:      'var(--text-muted)',
                    fontSize:   'var(--text-sm)',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    border:     '1px solid var(--border-default)',
                }}>
                    <Clock size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                    <p>Haz clic en "Cargar lista" para ver los registros</p>
                </div>
            )}

            {loaded && Object.keys(porTaller).length === 0 && (
                <div style={{
                    textAlign:  'center',
                    padding:    'var(--space-16)',
                    color:      'var(--text-muted)',
                    fontSize:   'var(--text-sm)',
                    background: 'var(--bg-card)',
                    borderRadius: 'var(--radius-xl)',
                    border:     '1px solid var(--border-default)',
                }}>
                    No hay registros en lista de espera
                </div>
            )}

            {/* Grupos por taller */}
            {Object.entries(porTaller).map(([tallerNombre, registros]) => (
                <div
                    key={tallerNombre}
                    style={{
                        marginBottom:  'var(--space-6)',
                        background:    'var(--bg-card)',
                        border:        '1px solid var(--border-default)',
                        borderRadius:  'var(--radius-xl)',
                        overflow:      'hidden',
                    }}
                >
                    {/* Taller header */}
                    <div style={{
                        padding:       'var(--space-4) var(--space-6)',
                        borderBottom:  '1px solid var(--border-subtle)',
                        background:    'var(--bg-surface)',
                        display:       'flex',
                        alignItems:    'center',
                        gap:           'var(--space-3)',
                    }}>
                        <h3 style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                            {tallerNombre}
                        </h3>
                        <span style={{
                            padding:      '2px 8px',
                            borderRadius: 999,
                            background:   'var(--color-jade-500)22',
                            color:        'var(--color-jade-500)',
                            fontSize:     'var(--text-xs)',
                            fontWeight:   600,
                        }}>
                            {registros.length} persona{registros.length !== 1 ? 's' : ''}
                        </span>
                    </div>

                    {/* Tabla */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                            <thead>
                            <tr style={{ background: 'var(--bg-surface)' }}>
                                {['Nombre', 'Email', 'WhatsApp', 'Estado', 'Fecha', 'Acción'].map(h => (
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
                            {registros.map(r => (
                                <tr key={r.id} style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontWeight: 500 }}>
                                        {r.nombre || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)' }}>
                                        {r.email}
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                        {r.whatsapp
                                            ? (() => {
                                                // Limpiar formato JID de Baileys (@lid, @s.whatsapp.net) → solo dígitos
                                                const clean = String(r.whatsapp).replace(/@.*$/, '').replace(/\D/g, '')
                                                return <span>+{clean.slice(-10)}</span>
                                            })()
                                            : <span>—</span>
                                        }
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                                        <EstadoBadge estado={r.estado} />
                                    </td>
                                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 'var(--text-xs)' }}>
                                        {new Date(r.created_at).toLocaleDateString('es-MX')}
                                    </td>
                                    <td style={{ padding: 'var(--space-2) var(--space-4)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', minWidth: 160 }}>

                                            {/* Botón 1: Confirmar lugar */}
                                            {r.estado === 'pendiente' && (
                                                <button
                                                    onClick={() => handleConfirmarLugar(r)}
                                                    disabled={confirming === r.id}
                                                    style={{
                                                        display:      'flex',
                                                        alignItems:   'center',
                                                        gap:          5,
                                                        padding:      '5px 10px',
                                                        background:   'var(--color-jade-500)18',
                                                        border:       '1px solid var(--color-jade-500)66',
                                                        borderRadius: 'var(--radius-md)',
                                                        color:        'var(--color-jade-500)',
                                                        fontSize:     'var(--text-xs)',
                                                        fontWeight:   600,
                                                        cursor:       confirming === r.id ? 'wait' : 'pointer',
                                                        fontFamily:   'var(--font-sans)',
                                                        whiteSpace:   'nowrap',
                                                    }}
                                                >
                                                    <EnvelopeSimple size={13} weight="fill" />
                                                    {confirming === r.id ? 'Enviando...' : 'Confirmar lugar'}
                                                </button>
                                            )}

                                            {/* Botón 2: Generar código (inteligente) */}
                                            <button
                                                onClick={() => handleGenerarAcceso(r)}
                                                disabled={generating === r.id}
                                                style={{
                                                    display:      'flex',
                                                    alignItems:   'center',
                                                    gap:          5,
                                                    padding:      '5px 10px',
                                                    background:   generating === r.id
                                                        ? 'var(--bg-surface)'
                                                        : r.tiene_resplandor
                                                            ? '#f59e0b18'
                                                            : 'var(--color-jade-500)18',
                                                    border:       `1px solid ${r.tiene_resplandor ? '#f59e0b88' : 'var(--color-jade-500)88'}`,
                                                    borderRadius: 'var(--radius-md)',
                                                    color:        r.tiene_resplandor ? '#f59e0b' : 'var(--color-jade-500)',
                                                    fontSize:     'var(--text-xs)',
                                                    fontWeight:   600,
                                                    cursor:       generating === r.id ? 'wait' : 'pointer',
                                                    fontFamily:   'var(--font-sans)',
                                                    whiteSpace:   'nowrap',
                                                }}
                                            >
                                                {r.tiene_resplandor
                                                    ? <><Lightning size={13} weight="fill" />{generating === r.id ? 'Generando...' : 'Crear Chispa'}</>
                                                    : <><Sparkle   size={13} weight="fill" />{generating === r.id ? 'Generando...' : 'Crear Resplandor'}</>
                                                }
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}

            {/* Modal resultado token (chispa o resplandor) */}
            {lastToken && (
                <TokenResultModal
                    token={lastToken}
                    onClose={() => setLastToken(null)}
                />
            )}
        </div>
    )
}