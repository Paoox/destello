/**
 * Destello Admin — PageAdmin
 * Dashboard de administración de chispas.
 * Ensambla todos los componentes admin.
 * Protegida por AdminAuthOverlay hasta que el admin se autentique.
 */
import { useState, useEffect, useCallback } from 'react'
import { ArrowClockwise, SignOut }           from '@phosphor-icons/react'
import { useAdminSession }                   from '@hooks/useAdminSession.js'
import AdminAuthOverlay                      from '@components/admin/AdminAuthOverlay.jsx'
import ChispaStats                           from '@components/admin/ChispaStats.jsx'
import ChispaCreator                         from '@components/admin/ChispaCreator.jsx'
import ChispaList                            from '@components/admin/ChispaList.jsx'
import { apiListChispas, apiGetStats }       from '@services/adminApi.js'

export default function PageAdmin() {
    const { adminToken, isAuthenticated, isLoading, error, login, logout } = useAdminSession()

    const [chispas,    setChispas]    = useState([])
    const [stats,      setStats]      = useState(null)
    const [refreshing, setRefreshing] = useState(false)

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
            // Si el token expiró en sesión activa, forzar re-auth
            if (err.message?.includes('401') || err.message?.includes('inválido')) {
                logout()
            }
        } finally {
            setRefreshing(false)
        }
    }, [adminToken, logout])

    // Cargar datos al autenticarse
    useEffect(() => {
        if (isAuthenticated) fetchData()
    }, [isAuthenticated, fetchData])

    return (
        <>
            {/* Overlay de autenticación — bloquea todo hasta que el admin ingrese */}
            {!isAuthenticated && (
                <AdminAuthOverlay
                    onLogin={login}
                    isLoading={isLoading}
                    error={error}
                />
            )}

            {/* Dashboard — visible pero borroso hasta autenticarse */}
            <div style={{
                filter:         isAuthenticated ? 'none' : 'blur(12px)',
                pointerEvents:  isAuthenticated ? 'auto' : 'none',
                userSelect:     isAuthenticated ? 'auto' : 'none',
                transition:     'filter 0.3s ease',
                minHeight:      '100vh',
                padding:        'var(--space-8)',
                maxWidth:       1100,
                margin:         '0 auto',
            }}>
                {/* Header */}
                <div style={{
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'space-between',
                    marginBottom:   'var(--space-8)',
                    flexWrap:       'wrap',
                    gap:            'var(--space-3)',
                }}>
                    <div>
                        <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
                            ✦ Control de chispas
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                            Panel de administración · Solo acceso autorizado
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                            onClick={fetchData}
                            disabled={refreshing}
                            style={btnIconHeaderStyle}
                            title="Actualizar datos"
                        >
                            <ArrowClockwise size={18} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                        <button
                            onClick={logout}
                            style={{ ...btnIconHeaderStyle, color: 'var(--color-error)' }}
                            title="Cerrar sesión admin"
                        >
                            <SignOut size={18} />
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <section style={{ marginBottom: 'var(--space-8)' }}>
                    <ChispaStats stats={stats} />
                </section>

                {/* Crear + Lista */}
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