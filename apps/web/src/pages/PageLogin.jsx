/**
 * Destello — PageLogin
 * El modo claro/oscuro lo maneja tokens.css automáticamente.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, Eye, EyeSlash, ArrowRight } from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'

// ── SVG icons ─────────────────────────────────────────────────
const GoogleIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
)

const FacebookIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="#1877F2">
        <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.514c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
)

const InstagramIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24">
        <defs>
            <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#F58529"/>
                <stop offset="50%" stopColor="#DD2A7B"/>
                <stop offset="100%" stopColor="#8134AF"/>
            </linearGradient>
        </defs>
        <path fill="url(#ig-grad)" d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
)

// ── Botón OAuth ───────────────────────────────────────────────
function OAuthButton({ Icon, label, onClick }) {
    const [hovered, setHovered] = useState(false)
    return (
        <button
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 10, width: '100%',
                padding: '11px var(--space-4)',
                // rgba(0,0,0,0.05) funciona en claro Y oscuro: sutil en ambos
                background: hovered ? 'rgba(0,0,0,0.05)' : 'var(--bg-surface)',
                border: `2px solid ${hovered ? 'rgba(15,158,164,0.4)' : 'var(--border-default)'}`,
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.18s ease, border-color 0.18s ease',
            }}
        >
      <span style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 20, height: 20, flexShrink: 0,
      }}>
        <Icon />
      </span>
            {label}
        </button>
    )
}

// ── Divider ───────────────────────────────────────────────────
function Divider({ label = 'o' }) {
    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            margin: 'var(--space-4) 0',
        }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>
    )
}

// ── Página principal ──────────────────────────────────────────
export default function PageLogin() {
    const navigate = useNavigate()
    const { login, isLoading, error } = useAuthStore()

    // Solo para elegir la imagen del logo — el CSS maneja el resto
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const logo = prefersDark ? logoDark : logoLight

    const [codigoAcceso, setCodigo]   = useState('')
    const [showCode,     setShowCode] = useState(false)
    const [btnHovered, setBtnHovered] = useState(false)

    const handleCodeSubmit = async (e) => {
        e.preventDefault()
        await login({ code: codigoAcceso })
        navigate('/home')
    }

    const handleOAuth = (provider) => {
        window.location.href = `/api/auth/${provider}`
    }

    const btnActive = codigoAcceso && !isLoading

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-dark)',      // ← tokens.css lo adapta solo
            padding: 'var(--space-6)',
        }}>
            <div style={{ maxWidth: 420, width: '100%' }}>

                {/* Card */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-2xl)',
                    padding: 'var(--space-8)',
                    boxShadow: 'var(--shadow-lg)',  // ← en modo claro es la sombra suave
                }}>

                    {/* Cabecera */}
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                        <img
                            src={logo}
                            alt="Destello logo"
                            style={{
                                display: 'block',
                                width: 56, height: 56,
                                objectFit: 'contain',
                                margin: '0 auto var(--space-3)',
                                filter: 'drop-shadow(0 0 12px rgba(13,115,119,0.35))',
                            }}
                        />
                        <h1 style={{
                            fontSize: 'var(--text-2xl)',
                            fontWeight: 700,
                            margin: '0 0 4px',
                            letterSpacing: '-0.02em',
                            color: 'var(--text-primary)',  // ← tokens.css lo adapta solo
                        }}>
                            Destello
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0 }}>
                            Tu espacio de aprendizaje{' '}
                            <span style={{ color: 'var(--color-amber-600)', fontWeight: 600 }}>
                inmersivo
              </span>
                        </p>
                    </div>

                    {/* OAuth */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        <OAuthButton Icon={GoogleIcon}    label="Continuar con Google"    onClick={() => handleOAuth('google')} />
                        <OAuthButton Icon={FacebookIcon}  label="Continuar con Facebook"  onClick={() => handleOAuth('facebook')} />
                        <OAuthButton Icon={InstagramIcon} label="Continuar con Instagram" onClick={() => handleOAuth('instagram')} />
                    </div>

                    <Divider label="o usa tu código de acceso" />

                    {/* Formulario */}
                    <form onSubmit={handleCodeSubmit}>
                        <div style={{ position: 'relative' }}>
                            <Key size={16} style={{
                                position: 'absolute', left: 14, top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)', pointerEvents: 'none',
                            }} />
                            <input
                                type={showCode ? 'text' : 'password'}
                                placeholder="Código de acceso"
                                value={codigoAcceso}
                                onChange={(e) => setCodigo(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: 'var(--space-3) var(--space-10) var(--space-3) var(--space-10)',
                                    background: 'var(--bg-surface)',
                                    border: '1px solid var(--border-default)',
                                    borderRadius: 'var(--radius-lg)',
                                    color: 'var(--text-primary)',
                                    fontSize: 'var(--text-sm)',
                                    fontFamily: 'var(--font-sans)',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                }}
                            />
                            <button type="button" onClick={() => setShowCode(!showCode)} style={{
                                position: 'absolute', right: 12, top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none', border: 'none',
                                color: 'var(--text-muted)', cursor: 'pointer',
                                display: 'flex', alignItems: 'center',
                            }}>
                                {showCode ? <EyeSlash size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        {error && (
                            <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginTop: 8 }}>
                                {error}
                            </p>
                        )}

                        {/* Botón Continuar */}
                        <button
                            type="submit"
                            disabled={!btnActive}
                            onMouseEnter={() => setBtnHovered(true)}
                            onMouseLeave={() => setBtnHovered(false)}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                gap: 8, width: '100%',
                                marginTop: 'var(--space-3)',
                                padding: 'var(--space-3)',
                                background: btnActive
                                    ? (btnHovered ? '#0a8a8f' : 'var(--color-jade-500)')
                                    : 'var(--bg-surface)',
                                border: '1px solid transparent',
                                borderRadius: 'var(--radius-lg)',
                                color: btnActive ? '#FAF7F2' : 'var(--text-muted)',
                                fontFamily: 'var(--font-sans)',
                                fontWeight: 600,
                                fontSize: 'var(--text-sm)',
                                cursor: btnActive ? 'pointer' : 'not-allowed',
                                opacity: isLoading ? 0.7 : 1,
                                transform: btnActive && btnHovered ? 'translateY(-1px)' : 'translateY(0)',
                                boxShadow: btnActive && btnHovered ? '0 4px 16px rgba(13,115,119,0.35)' : 'none',
                                transition: 'background 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease, color 0.18s ease',
                            }}
                        >
                            {isLoading ? 'Verificando...' : 'Continuar'}
                            {!isLoading && <ArrowRight size={16} />}
                        </button>
                    </form>

                </div>
            </div>
        </div>
    )
}