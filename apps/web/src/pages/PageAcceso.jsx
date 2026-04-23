/**
 * PageAcceso — Validación de Resplandor
 * El usuario ingresa su código de invitación (Resplandor) antes de crear su cuenta.
 * Si el código es válido → guarda email en sessionStorage y navega a /login (registro).
 */
import { useState }      from 'react'
import { useNavigate }   from 'react-router-dom'
import { ArrowRight }    from '@phosphor-icons/react'
import AccessCodeInput   from '@components/AccessCodeInput'
import { apiValidarResplandor } from '@services/publicApi.js'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'

export default function PageAcceso() {
    const navigate = useNavigate()

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const logo = prefersDark ? logoDark : logoLight

    const [codigo,     setCodigo]     = useState('')
    const [error,      setError]      = useState(null)
    const [isLoading,  setIsLoading]  = useState(false)
    const [btnHovered, setBtnHovered] = useState(false)

    const btnActive = codigo.trim().length > 0 && !isLoading

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        try {
            const data = await apiValidarResplandor(codigo)

            // Guardamos el código y el email para pre-rellenar el registro
            sessionStorage.setItem('destello_resplandor', codigo.trim().toUpperCase())
            sessionStorage.setItem('destello_resplandor_email',  data.email  ?? '')
            sessionStorage.setItem('destello_resplandor_nombre', data.nombre ?? '')

            navigate('/login')

        } catch (err) {
            const mensajes = {
                'Código no reconocido':          'Ese código no existe. Verifica que lo escribiste bien.',
                'Este resplandor ha sido revocado': 'Este código fue desactivado. Contacta a soporte.',
                'Este resplandor ya fue utilizado': 'Este código ya fue usado para crear una cuenta.',
                'Este resplandor ha expirado':    'Este código ya expiró. Solicita uno nuevo.',
            }
            setError(mensajes[err.message] ?? 'Código inválido o expirado. Verifica e intenta de nuevo.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{
            position:   'fixed',
            inset:      0,
            overflowY:  'auto',
            display:    'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-dark)',
            padding:    'var(--space-6)',
            boxSizing:  'border-box',
        }}>

            {/* Glow decorativo */}
            <div style={{
                position:     'fixed',
                top: '30%', left: '50%',
                transform:    'translate(-50%, -50%)',
                width: 500, height: 500,
                borderRadius: '50%',
                background:   'radial-gradient(circle, rgba(13,115,119,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ maxWidth: 400, width: '100%', position: 'relative', zIndex: 1 }}>

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
                                display:    'block',
                                width: 52, height: 52,
                                objectFit:  'contain',
                                margin:     '0 auto var(--space-3)',
                                filter:     'drop-shadow(0 0 12px rgba(13,115,119,0.35))',
                            }}
                        />
                        <h1 style={{
                            fontSize:      'var(--text-2xl)',
                            fontWeight:    700,
                            margin:        '0 0 var(--space-2)',
                            letterSpacing: '-0.02em',
                            color:         'var(--text-primary)',
                        }}>
                            Activa tu cuenta
                        </h1>
                        <p style={{
                            margin:     0,
                            fontSize:   'var(--text-sm)',
                            color:      'var(--text-muted)',
                            lineHeight: 1.5,
                        }}>
                            Ingresa tu{' '}
                            <span style={{ color: 'var(--color-jade-500)', fontWeight: 600 }}>
                                Resplandor
                            </span>
                            {' '}— el código de invitación personal que recibiste por correo
                        </p>
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

                        <AccessCodeInput
                            value={codigo}
                            onChange={setCodigo}
                            error={error}
                            isLoading={isLoading}
                            placeholder="RESP-XXXX-XXXX"
                        />

                        <button
                            type="submit"
                            disabled={!btnActive}
                            onMouseEnter={() => setBtnHovered(true)}
                            onMouseLeave={() => setBtnHovered(false)}
                            style={{
                                display:        'flex',
                                alignItems:     'center',
                                justifyContent: 'center',
                                gap:            8,
                                width:          '100%',
                                padding:        'var(--space-3)',
                                background:     btnActive
                                    ? (btnHovered ? '#0a8a8f' : 'var(--color-jade-500)')
                                    : 'var(--bg-surface)',
                                border:         '1px solid transparent',
                                borderRadius:   'var(--radius-lg)',
                                color:          btnActive ? '#FAF7F2' : 'var(--text-muted)',
                                fontFamily:     'var(--font-sans)',
                                fontWeight:     600,
                                fontSize:       'var(--text-sm)',
                                cursor:         btnActive ? 'pointer' : 'not-allowed',
                                opacity:        isLoading ? 0.7 : 1,
                                transform:      btnActive && btnHovered ? 'translateY(-1px)' : 'translateY(0)',
                                boxShadow:      btnActive && btnHovered ? '0 4px 16px rgba(13,115,119,0.35)' : 'none',
                                transition:     'all 0.18s ease',
                            }}
                        >
                            {isLoading ? 'Verificando...' : 'Activar mi Resplandor'}
                            {!isLoading && <ArrowRight size={16} />}
                        </button>

                    </form>

                    {/* Footer */}
                    <p style={{
                        margin:    'var(--space-5) 0 0',
                        textAlign: 'center',
                        fontSize:  'var(--text-xs)',
                        color:     'var(--text-disabled)',
                    }}>
                        ¿No tienes un Resplandor?{' '}
                        <a
                            href="https://wa.me/TU_NUMERO_AQUI"
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color:          'var(--color-jade-500)',
                                fontWeight:     600,
                                textDecoration: 'none',
                                borderBottom:   '1px solid transparent',
                                transition:     'border-color 0.18s ease',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--color-jade-500)'}
                            onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
                        >
                            Solicita el tuyo
                        </a>
                    </p>

                </div>
            </div>
        </div>
    )
}