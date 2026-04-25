/**
 * Destello — PageLogin
 *
 * Dos modos completamente separados:
 *
 * MODO REGISTRO (viene de /acceso con resplandor válido):
 *   - Sin tabs, sin OAuth
 *   - Solo formulario: nombre, email (bloqueado), contraseña, confirmar
 *   - Llama a POST /api/auth/register y consume el resplandor
 *
 * MODO LOGIN (acceso directo a /login):
 *   - Sin opción de registrarse (eso va por /acceso)
 *   - OAuth + email+contraseña
 *   - Llama a POST /api/auth/login
 */
import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { Eye, EyeSlash, ArrowRight, CheckCircle, XCircle } from '@phosphor-icons/react'
import { useAuthStore } from '@store/useAuthStore.js'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'

// ── Iconos OAuth ──────────────────────────────────────────────────────────────
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
                    <stop offset="0%" stopColor="#FFDC80"/><stop offset="25%" stopColor="#FCAF45"/>
                    <stop offset="50%" stopColor="#F77737"/><stop offset="75%" stopColor="#C13584"/>
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
        <button onClick={onClick}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                    width:'100%', padding:'var(--space-3)',
                    background: hovered ? 'var(--bg-surface)' : 'transparent',
                    border:'1px solid var(--border-default)',
                    borderColor: hovered ? 'var(--color-jade-500)' : 'var(--border-default)',
                    borderRadius:'var(--radius-lg)', color:'var(--text-primary)',
                    fontSize:'var(--text-sm)', fontFamily:'var(--font-sans)', fontWeight:500,
                    cursor:'pointer', transition:'all 0.15s',
                }}>
            <Icon />{label}
        </button>
    )
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider({ label = 'o continúa con email' }) {
    return (
        <div style={{ display:'flex', alignItems:'center', gap:'var(--space-3)', margin:'var(--space-4) 0' }}>
            <div style={{ flex:1, height:1, background:'var(--border-subtle)' }}/>
            <span style={{ color:'var(--text-muted)', fontSize:'var(--text-xs)', whiteSpace:'nowrap' }}>{label}</span>
            <div style={{ flex:1, height:1, background:'var(--border-subtle)' }}/>
        </div>
    )
}

// ── Field con label ───────────────────────────────────────────────────────────
function Field({ label, type='text', placeholder, value, onChange, right, readOnly, hint }) {
    return (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            <label style={{ fontSize:'var(--text-xs)', color:'var(--text-muted)', fontWeight:500 }}>
                {label}
            </label>
            <div style={{ position:'relative' }}>
                <input
                    type={type} placeholder={placeholder} value={value}
                    onChange={onChange} readOnly={readOnly}
                    style={{
                        width:'100%',
                        padding: right ? 'var(--space-3) 44px var(--space-3) var(--space-3)' : 'var(--space-3)',
                        background: readOnly ? 'var(--bg-dark)' : 'var(--bg-surface)',
                        border:'1px solid var(--border-default)',
                        borderRadius:'var(--radius-lg)',
                        color: readOnly ? 'var(--text-muted)' : 'var(--text-primary)',
                        fontSize:'var(--text-sm)', fontFamily:'var(--font-sans)',
                        outline:'none', boxSizing:'border-box',
                        opacity: readOnly ? 0.7 : 1, cursor: readOnly ? 'default' : 'text',
                    }}
                />
                {right && (
                    <div style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)' }}>
                        {right}
                    </div>
                )}
            </div>
            {hint && <p style={{ margin:0, fontSize:'var(--text-xs)', color:'var(--text-disabled)' }}>{hint}</p>}
        </div>
    )
}

// ── Validación de contraseña ──────────────────────────────────────────────────
function PasswordRules({ password }) {
    const rules = [
        { label: 'Mínimo 8 caracteres',       ok: password.length >= 8 },
        { label: 'Al menos una mayúscula',     ok: /[A-Z]/.test(password) },
        { label: 'Al menos un número',         ok: /[0-9]/.test(password) },
    ]
    if (!password) return null
    return (
        <div style={{ display:'flex', flexDirection:'column', gap:3, marginTop:2 }}>
            {rules.map(r => (
                <div key={r.label} style={{ display:'flex', alignItems:'center', gap:5,
                    fontSize:'var(--text-xs)', color: r.ok ? '#10B981' : 'var(--text-disabled)' }}>
                    {r.ok
                        ? <CheckCircle size={13} weight="fill" />
                        : <XCircle size={13} weight="fill" />}
                    {r.label}
                </div>
            ))}
        </div>
    )
}

function passwordIsStrong(p) {
    return p.length >= 8 && /[A-Z]/.test(p) && /[0-9]/.test(p)
}

// ── Wrapper visual compartido ─────────────────────────────────────────────────
function PageShell({ children }) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const logo = prefersDark ? logoDark : logoLight
    return (
        <div style={{
            position:'fixed', inset:0, display:'flex', alignItems:'flex-start',
            justifyContent:'center', background:'var(--bg-dark)',
            padding:'var(--space-8) var(--space-6)', boxSizing:'border-box', overflowY:'auto',
        }}>
            <div style={{
                position:'fixed', top:'35%', left:'50%', transform:'translate(-50%,-50%)',
                width:600, height:600, borderRadius:'50%', pointerEvents:'none',
                background:'radial-gradient(circle, rgba(13,115,119,0.08) 0%, transparent 70%)',
            }}/>
            <div style={{ maxWidth:420, width:'100%', position:'relative', zIndex:1 }}>
                <div style={{
                    background:'var(--bg-card)', border:'1px solid var(--border-default)',
                    borderRadius:'var(--radius-2xl)', padding:'var(--space-8)', boxShadow:'var(--shadow-lg)',
                }}>
                    {/* Logo */}
                    <div style={{ textAlign:'center', marginBottom:'var(--space-6)' }}>
                        <img src={logo} alt="Destello" style={{
                            display:'block', width:52, height:52, margin:'0 auto var(--space-3)',
                            objectFit:'contain', filter:'drop-shadow(0 0 14px rgba(13,115,119,0.4))',
                        }}/>
                        <h1 style={{
                            fontSize:'var(--text-2xl)', fontWeight:700,
                            margin:'0 0 var(--space-1)', letterSpacing:'-0.02em', color:'var(--text-primary)',
                        }}>Destello</h1>
                        <p style={{ margin:0, fontSize:'var(--text-sm)', color:'var(--text-muted)' }}>
                            Tu espacio de aprendizaje{' '}
                            <span style={{ color:'var(--color-amber-600,#D97706)', fontWeight:600 }}>inmersivo</span>
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
    const [error,           setError]           = useState(null)

    const canSubmit = nombre.trim() && passwordIsStrong(password) && password === confirmPassword && !isLoading

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return }
        if (!passwordIsStrong(password))  { setError('La contraseña no cumple los requisitos.'); return }

        const result = await register({ email, password, nombre: nombre.trim(), resplandorCode })
        if (result.ok) {
            navigate('/home')
        } else {
            setError(result.error || 'Error al crear cuenta. Intenta de nuevo.')
        }
    }

    return (
        <PageShell>
            {/* Banner resplandor */}
            <div style={{
                background:'rgba(13,115,119,0.08)', border:'1px solid rgba(13,115,119,0.25)',
                borderRadius:'var(--radius-lg)', padding:'var(--space-3)',
                marginBottom:'var(--space-5)', fontSize:'var(--text-xs)',
                color:'var(--text-muted)', textAlign:'center', lineHeight:1.5,
            }}>
                ✨ Resplandor válido — Crea tu cuenta para acceder
            </div>

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
                <Field
                    label="Nombre"
                    placeholder="Tu nombre"
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                />
                <Field
                    label="Correo electrónico"
                    type="email"
                    value={email}
                    readOnly
                    hint="Vinculado a tu Resplandor"
                />
                <div>
                    <Field
                        label="Contraseña"
                        type={showPass ? 'text' : 'password'}
                        placeholder="Mínimo 8 caracteres, 1 mayúscula y 1 número"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        right={
                            <button type="button" onClick={() => setShowPass(p=>!p)}
                                    style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:0, display:'flex' }}>
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
                        <button type="button" onClick={() => setShowConfirm(p=>!p)}
                                style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:0, display:'flex' }}>
                            {showConfirm ? <EyeSlash size={17}/> : <Eye size={17}/>}
                        </button>
                    }
                />

                {/* Indicador de contraseñas coinciden */}
                {confirmPassword && (
                    <p style={{ margin:0, fontSize:'var(--text-xs)',
                        color: password === confirmPassword ? '#10B981' : 'var(--color-error)' }}>
                        {password === confirmPassword ? '✓ Las contraseñas coinciden' : '✗ Las contraseñas no coinciden'}
                    </p>
                )}

                {error && (
                    <p style={{ color:'var(--color-error)', fontSize:'var(--text-xs)', margin:0 }}>{error}</p>
                )}

                <button type="submit" disabled={!canSubmit} style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    width:'100%', marginTop:'var(--space-1)', padding:'var(--space-3)',
                    background: canSubmit ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                    border:'1px solid transparent', borderRadius:'var(--radius-lg)',
                    color: canSubmit ? '#FAF7F2' : 'var(--text-muted)',
                    fontFamily:'var(--font-sans)', fontWeight:600, fontSize:'var(--text-sm)',
                    cursor: canSubmit ? 'pointer' : 'not-allowed',
                    opacity: isLoading ? 0.7 : 1, transition:'background 0.2s',
                }}>
                    {isLoading ? 'Creando tu cuenta...' : 'Crear mi cuenta'}
                    {!isLoading && <ArrowRight size={16}/>}
                </button>
            </form>
        </PageShell>
    )
}

// ══════════════════════════════════════════════════════════════════════════════
// FORMULARIO DE LOGIN (usuario con cuenta existente)
// ══════════════════════════════════════════════════════════════════════════════
function LoginForm() {
    const navigate = useNavigate()
    const { login, isLoading, error } = useAuthStore()

    const [email,    setEmail]    = useState('')
    const [password, setPassword] = useState('')
    const [showPass, setShowPass] = useState(false)
    const [localError, setLocalError] = useState(null)

    const handleOAuth = (provider) => { window.location.href = `/api/auth/${provider}` }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLocalError(null)
        await login({ email, password })
        // Si login fue exitoso, navega
        const { token } = useAuthStore.getState()
        if (token) navigate('/home')
    }

    const displayError = localError || error

    return (
        <PageShell>
            {/* OAuth */}
            <div style={{ display:'flex', flexDirection:'column', gap:'var(--space-2)' }}>
                <OAuthButton icon={IconGoogle}    label="Continuar con Google"    onClick={() => handleOAuth('google')}/>
                <OAuthButton icon={IconFacebook}  label="Continuar con Facebook"  onClick={() => handleOAuth('facebook')}/>
                <OAuthButton icon={IconInstagram} label="Continuar con Instagram" onClick={() => handleOAuth('instagram')}/>
            </div>

            <Divider />

            <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:'var(--space-3)' }}>
                <Field
                    label="Correo electrónico" type="email" placeholder="tu@email.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                />
                <Field
                    label="Contraseña"
                    type={showPass ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    right={
                        <button type="button" onClick={() => setShowPass(p=>!p)}
                                style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', padding:0, display:'flex' }}>
                            {showPass ? <EyeSlash size={17}/> : <Eye size={17}/>}
                        </button>
                    }
                />

                {displayError && (
                    <p style={{ color:'var(--color-error)', fontSize:'var(--text-xs)', margin:0 }}>{displayError}</p>
                )}

                <div style={{ textAlign:'right', marginTop:-6 }}>
                    <Link to="/recuperar-contrasena" style={{
                        fontSize:'var(--text-xs)', color:'var(--color-jade-500)',
                        fontWeight:500, textDecoration:'none',
                    }}>¿Olvidaste tu contraseña?</Link>
                </div>

                <button type="submit" disabled={!email || !password || isLoading} style={{
                    display:'flex', alignItems:'center', justifyContent:'center', gap:8,
                    width:'100%', marginTop:'var(--space-1)', padding:'var(--space-3)',
                    background: email && password ? 'var(--color-jade-500)' : 'var(--bg-surface)',
                    border:'1px solid transparent', borderRadius:'var(--radius-lg)',
                    color: email && password ? '#FAF7F2' : 'var(--text-muted)',
                    fontFamily:'var(--font-sans)', fontWeight:600, fontSize:'var(--text-sm)',
                    cursor: email && password ? 'pointer' : 'not-allowed',
                    opacity: isLoading ? 0.7 : 1, transition:'background 0.2s',
                }}>
                    {isLoading ? 'Entrando...' : 'Entrar'}
                    {!isLoading && <ArrowRight size={16}/>}
                </button>
            </form>

            {/* Link para ir a /acceso si no tienen cuenta */}
            <p style={{
                marginTop:'var(--space-5)', textAlign:'center',
                fontSize:'var(--text-xs)', color:'var(--text-disabled)',
            }}>
                ¿No tienes cuenta?{' '}
                <Link to="/acceso" style={{
                    color:'var(--color-jade-500)', fontWeight:600, textDecoration:'none',
                }}>
                    Activa tu Resplandor
                </Link>
            </p>
        </PageShell>
    )
}

// ── Exportación principal — decide qué formulario mostrar ─────────────────────
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

    return <LoginForm />
}