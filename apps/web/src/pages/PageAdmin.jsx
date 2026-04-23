/**
 * Destello Admin — PageAdmin
 * Dashboard de administración con tabs:
 *   ✦ Chispas | Lista de Espera | Talleres
 * Protegida por AdminAuthOverlay hasta que el admin se autentique.
 */
import { useState, useEffect, useCallback } from 'react'
import { ArrowClockwise, SignOut, Sparkle, UserList, BookOpen, Envelope } from '@phosphor-icons/react'
import { useAdminSession }     from '@hooks/useAdminSession.js'
import AdminAuthOverlay        from '@components/admin/AdminAuthOverlay.jsx'
import ChispaStats             from '@components/admin/ChispaStats.jsx'
import ChispaCreator           from '@components/admin/ChispaCreator.jsx'
import ChispaList              from '@components/admin/ChispaList.jsx'
import ListaEsperaPanel        from '@components/admin/ListaEsperaPanel.jsx'
import TalleresPanel           from '@components/admin/TalleresPanel.jsx'
import ResplandoresPanel       from '@components/admin/ResplandoresPanel.jsx'
import { apiListChispas, apiGetStats } from '@services/adminApi.js'

const TABS = [
    { id: 'chispas',      label: 'Chispas',          Icon: Sparkle   },
    { id: 'resplandores', label: 'Resplandores',      Icon: Envelope  },
    { id: 'espera',       label: 'Lista de espera',   Icon: UserList  },
    { id: 'talleres',     label: 'Talleres',           Icon: BookOpen  },
]

export default function PageAdmin() {
    const { adminToken, isAuthenticated, isLoading, error, login, logout } = useAdminSession()

    const [activeTab,  setActiveTab]  = useState('chispas')
    const [chispas,    setChispas]    = useState([])
    const [stats,      setStats]      = useState(null)
    const [refreshing, setRefreshing] = useState(false)

    const fetchChispasData = useCallback(async () => {
        if (!adminToken) return
        setRefreshing(true)
        try {
            const [chispasData, statsData] = await Promise.all([
                apiListChispas(adminToken),
                apiGetStats(adminToken),
            ])
            setChispas(chispasData.chispas)
            setStats(statsData.stats)
        } catch (err) {
            if (err.message?.includes('401') || err.message?.includes('inválido')) logout()
        } finally {
            setRefreshing(false)
        }
    }, [adminToken, logout])

    useEffect(() => {
        if (isAuthenticated) fetchChispasData()
    }, [isAuthenticated, fetchChispasData])

    return (
        <>
            {!isAuthenticated && (
                <AdminAuthOverlay
                    onLogin={login}
                    isLoading={isLoading}
                    error={error}
                />
            )}

            <div style={{
                filter:        isAuthenticated ? 'none' : 'blur(12px)',
                pointerEvents: isAuthenticated ? 'auto' : 'none',
                userSelect:    isAuthenticated ? 'auto' : 'none',
                transition:    'filter 0.3s ease',
                minHeight:     '100vh',
                padding:       'var(--space-8)',
                maxWidth:      1200,
                margin:        '0 auto',
            }}>
                {/* ── Header ── */}
                <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    marginBottom:   'var(--space-6)',
                    flexWrap:       'wrap',
                    gap:            'var(--space-3)',
                }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                            ✦ Panel de administración
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                            InnovaSchool · Solo acceso autorizado
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {activeTab === 'chispas' && (
                            <button
                                onClick={fetchChispasData}
                                disabled={refreshing}
                                style={btnIconStyle}
                                title="Actualizar datos"
                            >
                                <ArrowClockwise
                                    size={18}
                                    style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }}
                                />
                            </button>
                        )}
                        <button
                            onClick={logout}
                            style={{ ...btnIconStyle, color: 'var(--color-error)' }}
                            title="Cerrar sesión admin"
                        >
                            <SignOut size={18} />
                        </button>
                    </div>
                </div>

                {/* ── Stats (siempre visibles en tab chispas) ── */}
                {activeTab === 'chispas' && (
                    <section style={{ marginBottom: 'var(--space-6)' }}>
                        <ChispaStats stats={stats} />
                    </section>
                )}

                {/* ── Tabs ── */}
                <div style={{
                    display:      'flex',
                    gap:          'var(--space-1)',
                    marginBottom: 'var(--space-6)',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: 0,
                }}>
                    {TABS.map(({ id, label, Icon }) => {
                        const active = activeTab === id
                        return (
                            <button
                                key={id}
                                onClick={() => setActiveTab(id)}
                                style={{
                                    display:       'flex',
                                    alignItems:    'center',
                                    gap:           6,
                                    padding:       'var(--space-3) var(--space-5)',
                                    background:    'none',
                                    border:        'none',
                                    borderBottom:  active ? '2px solid var(--color-jade-500)' : '2px solid transparent',
                                    color:         active ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontWeight:    active ? 600 : 400,
                                    fontSize:      'var(--text-sm)',
                                    cursor:        'pointer',
                                    fontFamily:    'var(--font-sans)',
                                    marginBottom:  -1,
                                    transition:    'color 0.15s, border-color 0.15s',
                                }}
                            >
                                <Icon size={16} weight={active ? 'fill' : 'regular'} color={active ? 'var(--color-jade-500)' : 'currentColor'} />
                                {label}
                            </button>
                        )
                    })}
                </div>

                {/* ── Contenido por tab ── */}

                {activeTab === 'chispas' && (
                    <div style={{
                        display:             'grid',
                        gridTemplateColumns: '380px 1fr',
                        gap:                 'var(--space-6)',
                        alignItems:          'start',
                    }}>
                        <ChispaCreator
                            adminToken={adminToken}
                            onCreated={fetchChispasData}
                        />
                        <ChispaList
                            chispas={chispas}
                            adminToken={adminToken}
                            onRevoked={fetchChispasData}
                        />
                    </div>
                )}

                {activeTab === 'resplandores' && (
                    <ResplandoresPanel adminToken={adminToken} />
                )}

                {activeTab === 'espera' && (
                    <ListaEsperaPanel adminToken={adminToken} />
                )}

                {activeTab === 'talleres' && (
                    <TalleresPanel adminToken={adminToken} />
                )}
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg) } }
            `}</style>
        </>
    )
}

const btnIconStyle = {
    display:      'flex',
    alignItems:   'center',
    padding:      'var(--space-2)',
    background:   'var(--bg-surface)',
    border:       '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    color:        'var(--text-muted)',
    cursor:       'pointer',
}