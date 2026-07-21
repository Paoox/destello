/**
 * Destello — PageLogin
 *
 * MODO REGISTRO (viene de /acceso con resplandor válido):
 *   - Sin OAuth, solo formulario: nombre, email (bloqueado), contraseña, confirmar
 *   - Llama a POST /api/auth/register y consume el resplandor
 *
 * MODO LOGIN (acceso directo a /login):
 *   - Google OAuth via Firebase popup
 *   - Email + contraseña
 *   - Llama a POST /api/auth/social (Google) o POST /api/auth/login (email)
 */
import { useState, useEffect, useRef }           from 'react'
import { useNavigate, useLocation }              from 'react-router-dom'
import { Eye, EyeSlash, ArrowRight, ArrowLeft, CheckCircle, XCircle, WhatsappLogo, DeviceMobile } from '@phosphor-icons/react'
import { useAuthStore }                          from '@store/useAuthStore.js'
import { signInWithGoogle }                      from '@services/firebase.js'
import { WA_INSCRIBIRME_URL }                     from '../constants.js'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'

// ── Icono Google ──────────────────────────────────────────────────────────────
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

// ── Botón OAuth ───────────────────────────────────────────────────────────────
function OAuthButton({ icon: Icon, label, onClick, loading }) {
    const [hovered, setHovered] = useState(false)
    return (
        <button
            onClick={onClick}
            disabled={loading}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: 'var(--space-3)',
                background: hovered ? 'var(--bg-surface)' : 'transparent',
                border: '1px solid',
                borderColor: hovered ? 'var(--color-jade-500)' : 'var(--border-default)',
                borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 500,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.15s',
            }}>
            <Icon />{loading ? 'Conectando...' : label}
        </button>
    )
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider({ label = 'o continúa con email' }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', margin: 'var(--space-4) 0' }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}/>
            <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }}/>
        </div>
    )
}

// ── Field con label ───────────────────────────────────────────────────────────
function Field({ label, type = 'text', placeholder, value, onChange, right, readOnly, hint }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500 }}>
                {label}
            </label>
            <div style={{ position: 'relative' }}>
                <input
                    type={type} placeholder={placeholder} value={value}
                    onChange={onChange} readOnly={readOnly}
                    style={{
                        width: '100%',
                        padding: right ? 'var(--space-3) 44px var(--space-3) var(--space-3)' : 'var(--space-3)',
                        background: readOnly ? 'var(--bg-dark)' : 'var(--bg-surface)',
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)',
                        color: readOnly ? 'var(--text-muted)' : 'var(--text-primary)',
                        fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
                        outline: 'none', boxSizing: 'border-box',
                        opacity: readOnly ? 0.7 : 1, cursor: readOnly ? 'default' : 'text',
                    }}
                />
                {right && (
                    <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
                        {right}
                    </div>
                )}
            </div>
            {hint && <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-disabled)' }}>{hint}</p>}
        </div>
    )
}

// ── Validación de contraseña ──────────────────────────────────────────────────
function PasswordRules({ password }) {
    const rules = [
        { label: 'Mínimo 8 caracteres',   ok: password.length >= 8 },
        { label: 'Al menos una mayúscula', ok: /[A-Z]/.test(password) },
        { label: 'Al menos un número',     ok: /[0-9]/.test(password) },
    ]
    if (!password) return null
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2 }}>
            {rules.map(r => (
                <div key={r.label} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 'var(--text-xs)', color: r.ok ? '#10B981' : 'var(--text-disabled)',
                }}>
                    {r.ok ? <CheckCircle size={13} weight="fill"/> : <XCircle size={13} weight="fill"/>}
                    {r.label}
                </div>
            ))}
        </div>
    )
}

function passwordIsStrong(p) {
    return p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p)
}

// ── CSS responsive (media queries no se pueden con estilos inline) ─────────────
const LOGIN_CSS = `
.login-shell {
    padding: var(--space-8) var(--space-6);
    /* 'safe center' centra vertical pero cae a arriba si el contenido no cabe
       (evita que se corte la parte de arriba en formularios largos) */
    align-items: safe center;
}
/* Evita el zoom automático de iOS al enfocar un input (font-size >= 16px) */
.login-shell input { font-size: 16px !important; }

@media (max-width: 480px) {
    .login-shell        { padding: var(--space-5) var(--space-4); }
    .login-shell .login-card { padding: var(--space-6); border-radius: var(--radius-xl); }
    .login-shell .login-glow { width: 340px; height: 340px; }
}
`

// ── Wrapper visual compartido ─────────────────────────────────────────────────
function PageShell({ children }) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const logo = prefersDark ? logoDark : logoLight
    return (
        <div className="login-shell" style={{
            position: 'fixed', inset: 0, display: 'flex',
            justifyContent: 'center', background: 'var(--bg-dark)',
            boxSizing: 'border-box', overflowY: 'auto',
        }}>
            <style>{LOGIN_CSS}</style>
            <div className="login-glow" style={{
                position: 'fixed', top: '35%', left: '50%', transform: 'translate(-50%,-50%)',
                width: 600, height: 600, borderRadius: '50%', pointerEvents: 'none',
                background: 'radial-gradient(circle, rgba(13,115,119,0.08) 0%, transparent 70%)',
            }}/>
            <div style={{ maxWidth: 420, width: '100%', position: 'relative', zIndex: 1 }}>
                <div className="login-card" style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-2xl)', padding: 'var(--space-8)', boxShadow: 'var(--shadow-lg)',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                        <img src={logo} alt="Destello" style={{
                            display: 'block', width: 52, height: 52, margin: '0 auto var(--space-3)',
                            objectFit: 'contain', filter: 'drop-shadow(0 0 14px rgba(13,115,119,0.4))',
                        }}/>
                        <h1 style={{
                            fontSize: 'var(--text-2xl)', fontWeight: 700,
                            margin: '0 0 var(--space-1)', letterSpacing: '-0.02em', color: 'var(--text-primary)',
                        }}>Destello</h1>
                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                            Tu espacio de aprendizaje{' '}
                            <span style={{ color: 'var(--color-amber-600,#D97706)', fontWeight: 600 }}>inmersivo</span>
                        </p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    )
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO DE REGISTRO (viene de /acceso con Resplandor)
// ══════════════════════════════════════════════════════════════════════════════
function RegisterForm({ email, nombre: nombreInicial, resplandorCode }) {
    const navigate = useNavigate()
    const { register, isLoading } = useAuthStore()

    const [nombre,          setNombre]          = useState(nombreInicial || '')
    const [password,        setPassword]        = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPass,        setShowPass]        = useState(false)
    const [showConfirm,     setShowConfirm]     = useState(false)
    const [codigoInvitado,  setCodigoInvitado]  = useState('')
    const [error,           setError]           = useState(null)

    const canSubmit = nombre.trim() && passwordIsStrong(password) && password === confirmPassword && !isLoading

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return }
        if (!passwordIsStrong(password))  { setError('La contraseña no cumple los requisitos.'); return }

        const result = await register({
            email, password, nombre: nombre.trim(), resplandorCode,
            codigoInvitado: codigoInvitado.trim() || undefined,
        })
        if (result.ok) {
            navigate('/home')
        } else {
            setError(result.error || 'Error al crear cuenta. Intenta de nuevo.')
        }
    }

    return (
        <PageShell>
            <div style={{
                background: 'rgba(13,115,119,0.08)', border: '1px solid rgba(13,115,119,0.25)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)',
                marginBottom: 'var(--space-5)', fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5,
            }}>
                ✨ Resplandor válido — Crea tu cuenta para acceder
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <Field label="Nombre" placeholder="Tu nombre" value={nombre} onChange={e => setNombre(e.target.value)}/>
                <Field label="Correo electrónico" type="email" value={email} readOnly hint="Vinculado a tu Resplandor"/>
                <div>
                    <Field
                        label="Contraseña"
                        type={showPass ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres, 1 mayúscula y 1 número"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        right={
                            <button type="button" onClick={() => setShowPass(p => !p)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                                {showPass ? <EyeSlash size={17}/> : <Eye size={17}/>}
                            </button>
                        }
                    />
                    <PasswordRules password={password}/>
                </div>
                <Field
                    label="Confirmar contraseña"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    right={
                        <button type="button" onClick={() => setShowConfirm(p => !p)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            {showConfirm ? <EyeSlash size={17}/> : <Eye size={17}/>}
                        </button>
                    }
                />

                {confirmPassword && (
                    <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: password === confirmPassword ? '#10B981' : 'var(--color-error)' }}>
                        {password === confirmPassword ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                    </p>
                )}

                <Field
                    label="Código de invitado (opcional)"
                    placeholder="Ej. PAOLA-9F2A"
                    value={codigoInvitado}
                    onChange={e => setCodigoInvitado(e.target.value.toUpperCase())}
                    hint="¿Un amigo te invitó? Escribe su código de polvo estelar y gana Estrellas juntos"
                />

                {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 0 }}>{error}</p>}

                <button type="submit" disabled={!canSubmit} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', marginTop: 'var(--space-1)', padding: 'var(--space-3)',
                    background: canSubmit ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                    border: '1px solid transparent', borderRadius: 'var(--radius-lg)',
                    color: canSubmit ? '#FAF7F2' : 'var(--text-muted)',
                    fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-sm)',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    opacity: isLoading ? 0.7 : 1, transition: 'background 0.2s',
                }}>
                    {isLoading ? 'Creando tu cuenta...' : 'Crear mi cuenta'}
                    {!isLoading && <ArrowRight size={16}/>}
                </button>
            </form>
        </PageShell>
    )
}

// ══════════════════════════════════════════════════════════════════════════════
// PANTALLA PRINCIPAL DE LOGIN — solo Google + liga "entrar con mi número"
// ══════════════════════════════════════════════════════════════════════════════
function GoogleChoice({ onPhone }) {
    const navigate = useNavigate()

    const [localError,    setLocalError]    = useState(null)
    const [googleLoading, setGoogleLoading] = useState(false)

    // ── Login con Google via Firebase ─────────────────────────────────────────
    const handleGoogleLogin = async () => {
        setGoogleLoading(true)
        setLocalError(null)
        try {
            const { idToken } = await signInWithGoogle()

            const res  = await fetch('/api/auth/social', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ idToken, provider: 'google' }),
            })
            const data = await res.json()

            if (!res.ok) {
                setLocalError(data.message || 'No encontramos cuenta con ese correo de Google.')
                return
            }

            // Guardar token en el store
            useAuthStore.setState({ token: data.token, user: data.user, error: null })
            sessionStorage.setItem('destello_token', data.token)
            if (data.user) sessionStorage.setItem('destello_user', JSON.stringify(data.user))

            // Si ya tiene número verificado → directo a home.
            // Si no → arranca el onboarding: verificar número por WhatsApp + nombre.
            if (data.user?.whatsapp) {
                navigate('/home')
            } else {
                onPhone()
            }
        } catch (err) {
            // El usuario cerró el popup — no es error real
            if (err.code === 'auth/popup-closed-by-user' ||
                err.code === 'auth/cancelled-popup-request') return
            setLocalError('Error al conectar con Google. Intenta de nuevo.')
        } finally {
            setGoogleLoading(false)
        }
    }

    return (
        <PageShell>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                <OAuthButton
                    icon={IconGoogle}
                    label="Continuar con Google"
                    onClick={handleGoogleLogin}
                    loading={googleLoading}
                />
            </div>

            {localError && (
                <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 'var(--space-3) 0 0', textAlign: 'center' }}>
                    {localError}
                </p>
            )}

            <Divider label="o" />

            {/* Entrar con número de WhatsApp */}
            <button
                onClick={onPhone}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    width: '100%', padding: 'var(--space-3)',
                    background: 'transparent',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
                    fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', fontWeight: 500,
                    cursor: 'pointer', transition: 'all 0.15s',
                }}
            >
                <WhatsappLogo size={19} weight="fill" color="#25D366" />
                Entrar con mi número
            </button>

            <p style={{
                marginTop: 'var(--space-5)', textAlign: 'center',
                fontSize: 'var(--text-xs)', color: 'var(--text-disabled)',
            }}>
                ¿No tienes cuenta?{' '}
                <a href={WA_INSCRIBIRME_URL} target="_blank" rel="noreferrer"
                   style={{ color: 'var(--color-jade-500)', fontWeight: 600, textDecoration: 'none' }}>
                    Inscríbete por WhatsApp
                </a>
            </p>
        </PageShell>
    )
}

// ══════════════════════════════════════════════════════════════════════════════
// FLUJO DE CÓDIGO POR WHATSAPP — captura de número + código OTP de 6 dígitos
// ══════════════════════════════════════════════════════════════════════════════
function PhoneAuth({ onBack, onVerified }) {
    const [step,     setStep]     = useState('number')      // 'number' | 'code'
    const [phone,    setPhone]    = useState('')            // 10 dígitos
    const [code,     setCode]     = useState(['', '', '', '', '', ''])
    const [error,    setError]    = useState(null)
    const [loading,  setLoading]  = useState(false)
    const [resendIn, setResendIn] = useState(0)

    const boxRefs   = useRef([])
    const phoneValid = /^\d{10}$/.test(phone)
    const codeStr    = code.join('')

    // ── Contador para reenviar ────────────────────────────────────────────────
    useEffect(() => {
        if (resendIn <= 0) return
        const t = setInterval(() => setResendIn(s => (s <= 1 ? 0 : s - 1)), 1000)
        return () => clearInterval(t)
    }, [resendIn])

    // ── Enviar código por WhatsApp ────────────────────────────────────────────
    const sendCode = async () => {
        if (!phoneValid) { setError('Ingresa tu número a 10 dígitos.'); return }
        setError(null)
        setLoading(true)
        try {
            const res  = await fetch('/api/auth/phone/send-code', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ whatsapp: phone }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) { setError(data.message || 'No se pudo enviar el código.'); return }
            setStep('code')
            setResendIn(30)
            setTimeout(() => boxRefs.current[0]?.focus(), 50)
        } catch {
            setError('Error de conexión. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    // ── Verificar código ──────────────────────────────────────────────────────
    const verify = async () => {
        if (codeStr.length !== 6) { setError('El código tiene 6 dígitos.'); return }
        setError(null)
        setLoading(true)
        try {
            // Si viene del onboarding de Google ya hay token → liga el número.
            const token = sessionStorage.getItem('destello_token')
            const res = await fetch('/api/auth/phone/verify', {
                method:  'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ whatsapp: phone, code: codeStr }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) { setError(data.message || 'Código inválido.'); return }

            // Guardar sesión (verify emite un JWT nuevo en ambos flujos)
            useAuthStore.setState({ token: data.token, user: data.user, error: null })
            sessionStorage.setItem('destello_token', data.token)
            if (data.user) sessionStorage.setItem('destello_user', JSON.stringify(data.user))

            onVerified?.(data.user)
        } catch {
            setError('Error de conexión. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    // ── Manejo de las cajitas del código ──────────────────────────────────────
    const onCodeChange = (i, val) => {
        const digit = val.replace(/\D/g, '').slice(-1)
        const next  = [...code]
        next[i] = digit
        setCode(next)
        if (digit && i < 5) boxRefs.current[i + 1]?.focus()
    }
    const onCodeKeyDown = (i, e) => {
        if (e.key === 'Backspace' && !code[i] && i > 0) boxRefs.current[i - 1]?.focus()
    }
    const onCodePaste = (e) => {
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
        if (!pasted) return
        e.preventDefault()
        const next = ['', '', '', '', '', '']
        pasted.split('').forEach((d, idx) => { next[idx] = d })
        setCode(next)
        boxRefs.current[Math.min(pasted.length, 5)]?.focus()
    }

    return (
        <PageShell>
            {/* Volver */}
            <button
                onClick={step === 'code' ? () => { setStep('number'); setError(null) } : onBack}
                style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', color: 'var(--text-muted)',
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                    cursor: 'pointer', padding: 0, marginBottom: 'var(--space-4)',
                }}
            >
                <ArrowLeft size={14} /> Volver
            </button>

            {step === 'number' ? (
                <>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 'var(--radius-xl)',
                            background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 'var(--space-3)',
                        }}>
                            <WhatsappLogo size={26} weight="fill" color="#25D366" />
                        </div>
                        <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Entra con tu número
                        </h2>
                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Te enviaremos un código por WhatsApp para confirmar que eres tú.
                        </p>
                    </div>

                    <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontWeight: 500 }}>
                        Número de WhatsApp
                    </label>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
                        background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-lg)', padding: '0 var(--space-3)',
                    }}>
                        <span style={{ fontSize: 16, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                            🇲🇽 +52
                        </span>
                        <div style={{ width: 1, height: 22, background: 'var(--border-default)' }} />
                        <input
                            type="tel"
                            inputMode="numeric"
                            placeholder="10 dígitos"
                            value={phone}
                            onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            onKeyDown={e => { if (e.key === 'Enter' && phoneValid) sendCode() }}
                            style={{
                                flex: 1, border: 'none', background: 'transparent', outline: 'none',
                                padding: 'var(--space-3) 0', color: 'var(--text-primary)',
                                fontSize: 16, fontFamily: 'var(--font-sans)', letterSpacing: '0.06em',
                            }}
                        />
                    </div>

                    {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 'var(--space-2) 0 0' }}>{error}</p>}

                    <button
                        onClick={sendCode}
                        disabled={!phoneValid || loading}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            width: '100%', marginTop: 'var(--space-5)', padding: 'var(--space-3)',
                            background: phoneValid ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                            border: '1px solid transparent', borderRadius: 'var(--radius-lg)',
                            color: phoneValid ? '#FAF7F2' : 'var(--text-muted)',
                            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-sm)',
                            cursor: phoneValid ? 'pointer' : 'not-allowed',
                            opacity: loading ? 0.7 : 1, transition: 'background 0.2s',
                        }}
                    >
                        {loading ? 'Enviando...' : 'Enviarme el código'}
                        {!loading && <ArrowRight size={16} />}
                    </button>
                </>
            ) : (
                <>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: 'var(--radius-xl)',
                            background: 'rgba(13,115,119,0.12)', border: '1px solid rgba(13,115,119,0.3)',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            marginBottom: 'var(--space-3)',
                        }}>
                            <DeviceMobile size={26} weight="fill" color="var(--color-jade-500)" />
                        </div>
                        <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Escribe tu código
                        </h2>
                        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Te lo mandamos por WhatsApp al{' '}
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                +52 {phone}
                            </span>
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'center' }} onPaste={onCodePaste}>
                        {code.map((d, i) => (
                            <input
                                key={i}
                                ref={el => (boxRefs.current[i] = el)}
                                type="tel"
                                inputMode="numeric"
                                maxLength={1}
                                value={d}
                                onChange={e => onCodeChange(i, e.target.value)}
                                onKeyDown={e => onCodeKeyDown(i, e)}
                                style={{
                                    width: 44, height: 54, textAlign: 'center',
                                    background: 'var(--bg-surface)', border: `1px solid ${d ? 'var(--color-jade-500)' : 'var(--border-default)'}`,
                                    borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
                                    fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-sans)',
                                    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s',
                                }}
                            />
                        ))}
                    </div>

                    {error && <p style={{ color: error.startsWith('✨') ? 'var(--color-amber-600)' : 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 'var(--space-3) 0 0', textAlign: 'center' }}>{error}</p>}

                    <button
                        onClick={verify}
                        disabled={codeStr.length !== 6 || loading}
                        style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            width: '100%', marginTop: 'var(--space-5)', padding: 'var(--space-3)',
                            background: codeStr.length === 6 ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                            border: '1px solid transparent', borderRadius: 'var(--radius-lg)',
                            color: codeStr.length === 6 ? '#FAF7F2' : 'var(--text-muted)',
                            fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-sm)',
                            cursor: codeStr.length === 6 ? 'pointer' : 'not-allowed',
                            opacity: loading ? 0.7 : 1, transition: 'background 0.2s',
                        }}
                    >
                        {loading ? 'Verificando...' : 'Verificar y entrar'}
                        {!loading && <ArrowRight size={16} />}
                    </button>

                    <p style={{ marginTop: 'var(--space-4)', textAlign: 'center', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {resendIn > 0 ? (
                            <>Reenviar código en {resendIn}s</>
                        ) : (
                            <button onClick={sendCode} style={{ background: 'none', border: 'none', color: 'var(--color-jade-500)', fontWeight: 600, cursor: 'pointer', fontSize: 'var(--text-xs)', padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                                Reenviar código
                            </button>
                        )}
                    </p>
                </>
            )}
        </PageShell>
    )
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO DE NOMBRE — para el certificado (nombre + apellidos)
// ══════════════════════════════════════════════════════════════════════════════
function NameForm({ onDone }) {
    const [nombres,   setNombres]   = useState('')
    const [paterno,   setPaterno]   = useState('')
    const [materno,   setMaterno]   = useState('')
    const [error,     setError]     = useState(null)
    const [loading,   setLoading]   = useState(false)

    const canSubmit = nombres.trim() && paterno.trim() && !loading

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (!canSubmit) { setError('Escribe al menos tu nombre y apellido paterno.'); return }
        setError(null)
        setLoading(true)
        try {
            const token    = sessionStorage.getItem('destello_token')
            const apellido = `${paterno.trim()} ${materno.trim()}`.trim()
            const res = await fetch('/api/users/me', {
                method:  'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ nombre: nombres.trim(), apellido }),
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok) { setError(data.message || 'No se pudo guardar tu nombre.'); return }

            if (data.user) {
                useAuthStore.setState({ user: data.user })
                sessionStorage.setItem('destello_user', JSON.stringify(data.user))
            }
            onDone?.()
        } catch {
            setError('Error de conexión. Intenta de nuevo.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <PageShell>
            <div style={{ textAlign: 'center', marginBottom: 'var(--space-5)' }}>
                <h2 style={{ margin: '0 0 var(--space-1)', fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ¿Cómo te llamas?
                </h2>
                <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Escríbelo tal como quieres que aparezca en tu certificado.
                </p>
            </div>

            {/* Aviso importante — el certificado se emite con este nombre */}
            <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                background: 'rgba(217,119,6,0.10)', border: '1px solid rgba(217,119,6,0.3)',
                borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)',
                marginBottom: 'var(--space-5)',
            }}>
                <CheckCircle size={16} weight="fill" color="var(--color-amber-600)" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--text-primary)' }}>Importante:</strong> tu certificado se
                    emitirá con este nombre. Revísalo bien antes de continuar.
                </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                <Field label="Nombre(s)"        placeholder="Tu nombre o nombres" value={nombres} onChange={e => setNombres(e.target.value)} />
                <Field label="Apellido paterno"  placeholder="Apellido paterno"    value={paterno} onChange={e => setPaterno(e.target.value)} />
                <Field label="Apellido materno (opcional)" placeholder="Apellido materno" value={materno} onChange={e => setMaterno(e.target.value)} />

                {error && <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 0 }}>{error}</p>}

                <button type="submit" disabled={!canSubmit} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', marginTop: 'var(--space-1)', padding: 'var(--space-3)',
                    background: canSubmit ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                    border: '1px solid transparent', borderRadius: 'var(--radius-lg)',
                    color: canSubmit ? '#FAF7F2' : 'var(--text-muted)',
                    fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-sm)',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    opacity: loading ? 0.7 : 1, transition: 'background 0.2s',
                }}>
                    {loading ? 'Guardando...' : 'Guardar y entrar'}
                    {!loading && <ArrowRight size={16} />}
                </button>
            </form>
        </PageShell>
    )
}

// ══════════════════════════════════════════════════════════════════════════════
// LOGIN — máquina de estados: login → número → nombre → home
// ══════════════════════════════════════════════════════════════════════════════
function LoginForm() {
    const navigate = useNavigate()
    const [stage, setStage] = useState('login')  // 'login' | 'phone' | 'name'

    // Tras verificar el número: si ya tiene nombre completo → home; si no → nombre.
    const afterPhone = (user) => {
        if (user?.nombre && String(user.nombre).trim()) navigate('/home')
        else setStage('name')
    }

    if (stage === 'name')  return <NameForm onDone={() => navigate('/home')} />
    if (stage === 'phone') return <PhoneAuth onBack={() => setStage('login')} onVerified={afterPhone} />
    return <GoogleChoice onPhone={() => setStage('phone')} />
}

// ── Exportación principal ─────────────────────────────────────────────────────
export default function PageLogin() {
    const location = useLocation()

    const resplandorEmail  = location.state?.email  || ''
    const resplandorNombre = location.state?.nombre || ''
    const resplandorCode   = sessionStorage.getItem('destello_resplandor') || ''
    const vieneDeAcceso    = !!resplandorCode

    if (vieneDeAcceso) {
        return (
            <RegisterForm
                email={resplandorEmail}
                nombre={resplandorNombre}
                resplandorCode={resplandorCode}
            />
        )
    }

    return <LoginForm/>
}