/**
 * Destello — PageLogin
 * Inicio de sesión / registro con OAuth + email+contraseña.
 * La chispa ya fue validada en PageAcceso antes de llegar aquí.
 */
import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeSlash, ArrowRight } from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'

// ── Iconos de marcas (SVG oficiales) ─────────────────────────────────────────

function IconGoogle() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
    )
}

function IconFacebook() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2"/>
        </svg>
    )
}

function IconInstagram() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#FFDC80"/>
                    <stop offset="25%" stopColor="#FCAF45"/>
                    <stop offset="50%" stopColor="#F77737"/>
                    <stop offset="75%" stopColor="#C13584"/>
                    <stop offset="100%" stopColor="#833AB4"/>
                </linearGradient>
            </defs>
            <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
        </svg>
    )
}

// ── Botón OAuth ───────────────────────────────────────────────────────────────
function OAuthButton({ icon: Icon, label, onClick }) {
    const [hovered, setHovered] = useState(false)
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            10,
                width:          '100%',
                padding:        'var(--space-3)',
                background:     hovered ? 'var(--bg-surface)' : 'transparent',
                border:         '1px solid var(--border-default)',
                borderColor:    hovered ? 'var(--border-muted, var(--color-jade-500))' : 'var(--border-default)',
                borderRadius:   'var(--radius-lg)',
                color:          'var(--text-primary)',
                fontSize:       'var(--text-sm)',
                fontFamily:     'var(--font-sans)',
                fontWeight:     500,
                cursor:         'pointer',
                transition:     'all 0.15s',
            }}
        >
            <Icon />
            {label}
        </button>
    )
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider({ label = 'o continúa con email' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-4) 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>
    )
}

// ── Input con label ───────────────────────────────────────────────────────────
function Field({ label, type = 'text', placeholder, value, onChange, right }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500 }}>
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                <input
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    style={{
                        width:        '100%',
                        padding:      right ? 'var(--space-3) 44px var(--space-3) var(--space-3)' : 'var(--space-3)',
                        background:   'var(--bg-surface)',
                        border:       '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        color:        'var(--text-primary)',
                        fontSize:     'var(--text-sm)',
                        fontFamily:   'var(--font-sans)',
                        outline:      'none',
                        boxSizing:    'border-box',
                    }}
                />
                {right && (
                    <div style={{
                        position:  'absolute',
                        right:     12,
                        top:       '50%',
                        transform: 'translateY(-50%)',
                    }}>
                        {right}
                    </div>
                )}
            </div>
        </div>
    )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PageLogin() {
    const navigate = useNavigate()
    const { login, isLoading, error } = useAuthStore()

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const logo = prefersDark ? logoDark : logoLight

    // 'login' | 'register'
    const [mode,            setMode]            = useState('login')
    const [email,           setEmail]           = useState('')
    const [password,        setPassword]        = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPass,        setShowPass]        = useState(false)
    const [showConfirm,     setShowConfirm]     = useState(false)
    const [localError,      setLocalError]      = useState(null)

    const handleOAuth = (provider) => {
        window.location.href = `/api/auth/${provider}`
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLocalError(null)

        if (mode === 'register') {
            if (password !== confirmPassword) {
                setLocalError('Las contraseñas no coinciden.')
                return
            }
            if (password.length < 8) {
                setLocalError('La contraseña debe tener al menos 8 caracteres.')
                return
            }
            // TODO: llamar endpoint de registro cuando esté listo
            setLocalError('Registro con email próximamente.')
            return
        }

        // Login
        await login({ email, password })
        navigate('/home')
    }

    const displayError = localError || error

    return (
        <div style={{
            position:       'fixed',
            inset:          0,
            display:        'flex',
            alignItems:     'flex-start',
            justifyContent: 'center',
            background:     'var(--bg-dark)',
            padding:        'var(--space-8) var(--space-6)',
            boxSizing:      'border-box',
            overflowY:      'auto',
        }}>
            {/* Glow de fondo */}
            <div style={{
                position:     'fixed',
                top: '35%', left: '50%',
                transform:    'translate(-50%, -50%)',
                width:        600, height: 600,
                borderRadius: '50%',
                background:   'radial-gradient(circle, rgba(13,115,119,0.08) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ maxWidth: 420, width: '100%', position: 'relative', zIndex: 1 }}>
                <div style={{
                    background:   'var(--bg-card)',
                    border:       '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-2xl)',
                    padding:      'var(--space-8)',
                    boxShadow:    'var(--shadow-lg)',
                }}>

                    {/* Cabecera */}
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                        <img
                            src={logo}
                            alt="Destello"
                            style={{
                                display:  'block',
                                width:    52, height: 52,
                                margin:   '0 auto var(--space-3)',
                                objectFit: 'contain',
                                filter:   'drop-shadow(0 0 14px rgba(13,115,119,0.4))',
                            }}
                        />
                        <h1 style={{
                            fontSize:      'var(--text-2xl)',
                            fontWeight:    700,
                            margin:        '0 0 var(--space-1)',
                            letterSpacing: '-0.02em',
                            color:         'var(--text-primary)',
                        }}>
                            Destello
                        </h1>
                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            Tu espacio de aprendizaje{' '}
                            <span style={{ color: 'var(--color-amber-600, #D97706)', fontWeight: 600 }}>
                                inmersivo
                            </span>
                        </p>
                    </div>

                    {/* Tabs login / registro */}
                    <div style={{
                        display:      'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap:          4,
                        background:   'var(--bg-surface)',
                        borderRadius: 'var(--radius-lg)',
                        padding:      4,
                        marginBottom: 'var(--space-5)',
                    }}>
                        {['login', 'register'].map(m => (
                            <button
                                key={m}
                                onClick={() => { setMode(m); setLocalError(null) }}
                                style={{
                                    padding:      'var(--space-2)',
                                    borderRadius: 'var(--radius-md)',
                                    border:       'none',
                                    background:   mode === m ? 'var(--bg-card)' : 'transparent',
                                    color:        mode === m ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontFamily:   'var(--font-sans)',
                                    fontWeight:   mode === m ? 600 : 400,
                                    fontSize:     'var(--text-sm)',
                                    cursor:       'pointer',
                                    transition:   'all 0.15s',
                                    boxShadow:    mode === m ? 'var(--shadow-sm, 0 1px 4px rgba(0,0,0,0.15))' : 'none',
                                }}
                            >
                                {m === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
                            </button>
                        ))}
                    </div>

                    {/* OAuth */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <OAuthButton icon={IconGoogle}    label="Continuar con Google"    onClick={() => handleOAuth('google')} />
                        <OAuthButton icon={IconFacebook}  label="Continuar con Facebook"  onClick={() => handleOAuth('facebook')} />
                        <OAuthButton icon={IconInstagram} label="Continuar con Instagram" onClick={() => handleOAuth('instagram')} />
                    </div>

                    <Divider />

                    {/* Formulario email + contraseña */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

                        <Field
                            label="Correo electrónico"
                            type="email"
                            placeholder="tu@email.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />

                        <Field
                            label="Contraseña"
                            type={showPass ? 'text' : 'password'}
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            right={
                                <button type="button" onClick={() => setShowPass(p => !p)}
                                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                    {showPass ? <EyeSlash size={17} /> : <Eye size={17} />}
                                </button>
                            }
                        />

                        {mode === 'register' && (
                            <Field
                                label="Confirmar contraseña"
                                type={showConfirm ? 'text' : 'password'}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                right={
                                    <button type="button" onClick={() => setShowConfirm(p => !p)}
                                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                        {showConfirm ? <EyeSlash size={17} /> : <Eye size={17} />}
                                    </button>
                                }
                            />
                        )}

                        {displayError && (
                            <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 0 }}>
                                {displayError}
                            </p>
                        )}

                        {/* Olvidé mi contraseña — solo en login */}
                        {mode === 'login' && (
                            <div style={{ textAlign: 'right', marginTop: -6 }}>
                                <Link
                                    to="/recuperar-contrasena"
                                    style={{
                                        fontSize:   'var(--text-xs)',
                                        color:      'var(--color-jade-500)',
                                        fontWeight: 500,
                                        textDecoration: 'none',
                                    }}
                                >
                                    ¿Olvidaste tu contraseña?
                                </Link>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!email || !password || isLoading}
                            style={{
                                display:        'flex',
                                alignItems:     'center',
                                justifyContent: 'center',
                                gap:            8,
                                width:          '100%',
                                marginTop:      'var(--space-1)',
                                padding:        'var(--space-3)',
                                background:     email && password ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                                border:         '1px solid transparent',
                                borderRadius:   'var(--radius-lg)',
                                color:          email && password ? '#FAF7F2' : 'var(--text-muted)',
                                fontFamily:     'var(--font-sans)',
                                fontWeight:     600,
                                fontSize:       'var(--text-sm)',
                                cursor:         email && password ? 'pointer' : 'not-allowed',
                                opacity:        isLoading ? 0.7 : 1,
                                transition:     'background 0.2s',
                            }}
                        >
                            {isLoading ? 'Un momento...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
                            {!isLoading && <ArrowRight size={16} />}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}