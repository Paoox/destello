/**
 * Destello Admin — PageAdmin
 * Dashboard de administración con tabs:
 *   ✦ Chispas | Talleres | Lista de espera
 * Protegida por AdminAuthOverlay hasta que el admin se autentique.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate }                       from 'react-router-dom'
import { ArrowClockwise, SignOut, Sparkle, BookOpen, ClockCounterClockwise, Sun } from '@phosphor-icons/react'
import { useAdminSession }                   from '@hooks/useAdminSession.js'
import AdminAuthOverlay                      from '@components/admin/AdminAuthOverlay.jsx'
import ChispaStats                           from '@components/admin/ChispaStats.jsx'
import ChispaCreator                         from '@components/admin/ChispaCreator.jsx'
import ChispaList                            from '@components/admin/ChispaList.jsx'
import TalleresAdmin                         from '@components/admin/TalleresAdmin.jsx'
import ListaEsperaAdmin                      from '@components/admin/ListaEsperaAdmin.jsx'
import RespladorAdmin                        from '@components/admin/RespladorAdmin.jsx'
import { apiListChispas, apiGetStats }       from '@services/adminApi.js'

const TABS = [
    { id: 'chispas',      label: 'Chispas',        Icon: Sparkle },
    { id: 'resplandores', label: 'Resplandores',    Icon: Sun },
    { id: 'talleres',     label: 'Talleres',        Icon: BookOpen },
    { id: 'lista-espera', label: 'Lista de espera', Icon: ClockCounterClockwise },
]

export default function PageAdmin() {
    const navigate = useNavigate()
    const { adminToken, isAuthenticated, isLoading, error, login, logout } = useAdminSession()

    const [activeTab,  setActiveTab]  = useState('chispas')
    const [chispas,    setChispas]    = useState([])
    const [stats,      setStats]      = useState(null)
    const [refreshing, setRefreshing] = useState(false)

    // Cerrar sesión y redirigir al perfil
    const handleLogout = useCallback(() => {
        logout()
        navigate('/perfil')
    }, [logout, navigate])

    const fetchData = useCallback(async () => {
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
            if (err.message?.includes('401') || err.message?.includes('inválido')) {
                logout()
            }
        } finally {
            setRefreshing(false)
        }
    }, [adminToken, logout])

    useEffect(() => {
        if (isAuthenticated) fetchData()
    }, [isAuthenticated, fetchData])

    return (
        <>
            {/* Overlay de autenticación */}
            {!isAuthenticated && (
                <AdminAuthOverlay
                    onLogin={login}
                    isLoading={isLoading}
                    error={error}
                />
            )}

            {/* Dashboard */}
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
                {/* Header */}
                <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    marginBottom:   'var(--space-6)',
                    flexWrap:       'wrap',
                    gap:            'var(--space-3)',
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{
                                fontSize:        'var(--text-xs)',
                                fontWeight:      700,
                                color:           'var(--color-jade-500)',
                                letterSpacing:   '0.08em',
                                textTransform:   'uppercase',
                                padding:         '3px 10px',
                                background:      'rgba(13,115,119,0.1)',
                                border:          '1px solid rgba(13,115,119,0.25)',
                                borderRadius:    'var(--radius-full)',
                            }}>
                                Destello
                            </span>
                        </div>
                        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
                            ✦ Panel de administración
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                            Solo acceso autorizado
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        {activeTab === 'chispas' && (
                            <button
                                onClick={fetchData}
                                disabled={refreshing}
                                style={btnIconHeaderStyle}
                                title="Actualizar datos"
                            >
                                <ArrowClockwise size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                            </button>
                        )}
                        <button
                            onClick={handleLogout}
                            style={{ ...btnIconHeaderStyle, color: 'var(--color-error)' }}
                            title="Cerrar sesión admin"
                        >
                            <SignOut size={18} />
                        </button>
                    </div>
                </div>

                {/* Stats (solo en tab chispas) */}
                {activeTab === 'chispas' && (
                    <section style={{ marginBottom: 'var(--space-6)' }}>
                        <ChispaStats stats={stats} />
                    </section>
                )}

                {/* Tabs */}
                <div style={{
                    display:      'flex',
                    gap:          'var(--space-1)',
                    marginBottom: 'var(--space-6)',
                    borderBottom: '1px solid var(--border-subtle)',
                    paddingBottom: 0,
                }}>
                    {TABS.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => setActiveTab(id)}
                            style={{
                                display:        'flex',
                                alignItems:     'center',
                                gap:            6,
                                padding:        'var(--space-3) var(--space-4)',
                                background:     'transparent',
                                border:         'none',
                                borderBottom:   activeTab === id ? '2px solid var(--color-jade-500)' : '2px solid transparent',
                                borderRadius:   0,
                                color:          activeTab === id ? 'var(--color-jade-500)' : 'var(--text-muted)',
                                fontFamily:     'var(--font-sans)',
                                fontWeight:     activeTab === id ? 700 : 400,
                                fontSize:       'var(--text-sm)',
                                cursor:         'pointer',
                                transition:     'all 0.15s',
                                marginBottom:   -1,
                            }}
                        >
                            <Icon size={16} weight={activeTab === id ? 'fill' : 'regular'} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Contenido del tab activo */}

                {/* Tab: Chispas */}
                {activeTab === 'chispas' && (
                    <div style={{
                        display:             'grid',
                        gridTemplateColumns: '380px 1fr',
                        gap:                 'var(--space-6)',
                        alignItems:          'start',
                    }}>
                        <ChispaCreator
                            adminToken={adminToken}
                            onCreated={fetchData}
                        />
                        <ChispaList
                            chispas={chispas}
                            adminToken={adminToken}
                            onRevoked={fetchData}
                        />
                    </div>
                )}

                {/* Tab: Resplandores */}
                {activeTab === 'resplandores' && (
                    <RespladorAdmin adminToken={adminToken} />
                )}

                {/* Tab: Talleres */}
                {activeTab === 'talleres' && (
                    <TalleresAdmin
                        adminToken={adminToken}
                        onChanged={() => {}}
                    />
                )}

                {/* Tab: Lista de espera */}
                {activeTab === 'lista-espera' && (
                    <ListaEsperaAdmin adminToken={adminToken} />
                )}
            </div>
        </>
    )
}

const btnIconHeaderStyle = {
    display:      'flex',
    alignItems:   'center',
    padding:      'var(--space-2)',
    background:   'var(--bg-surface)',
    border:       '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)',
    color:        'var(--text-muted)',
    cursor:       'pointer',
}