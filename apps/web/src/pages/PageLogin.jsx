/**
 * Destello — PageLogin
 * Página de inicio de sesión con Google/FB/Instagram + código de pago.
 * Modular: cada método de auth es un componente independiente.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    GoogleLogo,
    FacebookLogo,
    InstagramLogo,
    Key,
    Sparkle,
    Eye,
    EyeSlash,
    ArrowRight,
} from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'

// ── Subcomponente: botón de OAuth ─────────────────────────
function OAuthButton({ Icon, label, color, onClick }) {
    return (
        <button
            onClick={onClick}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 'var(--space-2)',
                width: '100%',
                padding: 'var(--space-3)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s',
            }}
        >
            <Icon size={20} color={color} weight="fill" />
            {label}
        </button>
    )
}

// ── Subcomponente: divider ────────────────────────────────
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

// ── Página principal ──────────────────────────────────────
export default function PageLogin() {
    const navigate = useNavigate()
    const { login, isLoading, error } = useAuthStore()

    const [mode, setMode]           = useState('oauth') // 'oauth' | 'code'
    const [codigoAcceso, setCodigo] = useState('')
    const [showCode, setShowCode]   = useState(false)

    const handleCodeSubmit = async (e) => {
        e.preventDefault()
        await login({ code: codigoAcceso })
        navigate('/home')
    }

    const handleOAuth = (provider) => {
        // TODO: redirigir a endpoint OAuth del API
        window.location.href = `/api/auth/${provider}`
    }

    return (
        <div style={{
            maxWidth: 420,
            margin: '0 auto',
            width: '100%',
        }}>
            {/* Card */}
            <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-2xl)',
                padding: 'var(--space-8)',
                boxShadow: 'var(--shadow-lg)',
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                    <Sparkle size={40} weight="fill" color="var(--color-jade-500)" />
                    <h1 style={{
                        fontSize: 'var(--text-2xl)',
                        fontWeight: 700,
                        marginTop: 'var(--space-2)',
                        letterSpacing: '-0.02em',
                    }}>
                        destello
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 4 }}>
                        Tu espacio de aprendizaje inmersivo
                    </p>
                </div>

                {/* OAuth buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                    <OAuthButton Icon={GoogleLogo}    label="Continuar con Google"    color="#EA4335" onClick={() => handleOAuth('google')} />
                    <OAuthButton Icon={FacebookLogo}  label="Continuar con Facebook"  color="#1877F2" onClick={() => handleOAuth('facebook')} />
                    <OAuthButton Icon={InstagramLogo} label="Continuar con Instagram" color="#E1306C" onClick={() => handleOAuth('instagram')} />
                </div>

                <Divider label="o usa tu código de acceso" />

                {/* Código de pago */}
                <form onSubmit={handleCodeSubmit}>
                    <div style={{ position: 'relative' }}>
                        <Key
                            size={18}
                            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                        />
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
                            }}
                        />
                        <button
                            type="button"
                            onClick={() => setShowCode(!showCode)}
                            style={{
                                position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                            }}
                        >
                            {showCode ? <EyeSlash size={18} /> : <Eye size={18} />}
                        </button>
                    </div>

                    {error && (
                        <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', marginTop: 8 }}>
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={!codigoAcceso || isLoading}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            width: '100%',
                            marginTop: 'var(--space-3)',
                            padding: 'var(--space-3)',
                            background: codigoAcceso ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                            border: '1px solid transparent',
                            borderRadius: 'var(--radius-lg)',
                            color: 'var(--text-primary)',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                            fontSize: 'var(--text-sm)',
                            cursor: codigoAcceso ? 'pointer' : 'not-allowed',
                            opacity: isLoading ? 0.7 : 1,
                            transition: 'background 0.2s',
                        }}
                    >
                        {isLoading ? 'Verificando...' : 'Entrar'}
                        {!isLoading && <ArrowRight size={16} />}
                    </button>
                </form>
            </div>
        </div>
    )
}