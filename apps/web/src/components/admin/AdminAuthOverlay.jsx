/**
 * Destello Admin — AdminAuthOverlay
 * Pantalla de contraseña que bloquea el contenido con blur.
 * Se renderiza encima del dashboard hasta que el admin se autentique.
 */
import { useState }          from 'react'
import { LockKey, Eye, EyeSlash, Sparkle } from '@phosphor-icons/react'

export default function AdminAuthOverlay({ onLogin, isLoading, error }) {
    const [password, setPassword] = useState('')
    const [showPwd,  setShowPwd]  = useState(false)

    const handleSubmit = (e) => {
        e.preventDefault()
        if (password) onLogin(password)
    }

    return (
        <div style={{
            position:        'fixed',
            inset:           0,
            zIndex:          100,
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            background:      'rgba(10, 10, 14, 0.85)',
            backdropFilter:  'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
        }}>
            <div style={{
                background:   'var(--bg-card)',
                border:       '1px solid var(--border-default)',
                borderRadius: 'var(--radius-2xl)',
                padding:      'var(--space-10)',
                width:        '100%',
                maxWidth:     380,
                boxShadow:    'var(--shadow-lg)',
                textAlign:    'center',
            }}>
                {/* Ícono */}
                <div style={{
                    display:        'inline-flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    width:          56,
                    height:         56,
                    borderRadius:   'var(--radius-xl)',
                    background:     'var(--color-jade-500)',
                    marginBottom:   'var(--space-5)',
                }}>
                    <LockKey size={28} weight="fill" color="#fff" />
                </div>

                <h2 style={{ fontSize: 'var(--text-xl)', fontWeight: 700, marginBottom: 4 }}>
                    Área restringida
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-7)' }}>
                    Ingresa tu contraseña de administrador para continuar.
                </p>

                <form onSubmit={handleSubmit}>
                    {/* Campo contraseña */}
                    <div style={{ position: 'relative', marginBottom: 'var(--space-3)' }}>
                        <input
                            type={showPwd ? 'text' : 'password'}
                            placeholder="Contraseña de admin"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoFocus
                            style={{
                                width:        '100%',
                                padding:      'var(--space-3) var(--space-10)',
                                background:   'var(--bg-surface)',
                                border:       `1px solid ${error ? 'var(--color-error)' : 'var(--border-default)'}`,
                                borderRadius: 'var(--radius-lg)',
                                color:        'var(--text-primary)',
                                fontSize:     'var(--text-sm)',
                                fontFamily:   'var(--font-sans)',
                                outline:      'none',
                                boxSizing:    'border-box',
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPwd(v => !v)}
                            style={{
                                position:   'absolute',
                                right:      12,
                                top:        '50%',
                                transform:  'translateY(-50%)',
                                background: 'none',
                                border:     'none',
                                color:      'var(--text-muted)',
                                cursor:     'pointer',
                                padding:    0,
                            }}
                        >
                            {showPwd ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginBottom: 'var(--space-3)' }}>
                            {error}
                        </p>
                    )}

                    {/* Botón */}
                    <button
                        type="submit"
                        disabled={!password || isLoading}
                        style={{
                            width:        '100%',
                            padding:      'var(--space-3)',
                            background:   password ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                            border:       '1px solid transparent',
                            borderRadius: 'var(--radius-lg)',
                            color:        'var(--text-primary)',
                            fontFamily:   'var(--font-sans)',
                            fontWeight:   600,
                            fontSize:     'var(--text-sm)',
                            cursor:       password && !isLoading ? 'pointer' : 'not-allowed',
                            opacity:      isLoading ? 0.7 : 1,
                            transition:   'background 0.2s',
                        }}
                    >
                        {isLoading ? 'Verificando...' : 'Acceder'}
                    </button>
                </form>
            </div>
        </div>
    )
}