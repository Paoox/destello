/**
 * PageAcceso — Validación de Resplandor de acceso
 * El usuario ingresa su código único antes de crear su cuenta.
 * Si el código es válido → navega a /login
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from '@phosphor-icons/react'
import AccessCodeInput from '@components/AccessCodeInput'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'
import { WA_NUMBER } from '../constants.js'

export default function PageAcceso() {
    const navigate = useNavigate()

    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const logo = prefersDark ? logoDark : logoLight

    const [codigo,    setCodigo]    = useState('')
    const [error,     setError]     = useState(null)
    const [isLoading, setIsLoading] = useState(false)
    const [btnHovered, setBtnHovered] = useState(false)

    const btnActive = codigo.trim().length > 0 && !isLoading

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        setIsLoading(true)

        try {
            const res = await fetch('/api/auth/resplandor/validate', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ code: codigo.trim().toUpperCase() }),
            })

            const data = await res.json()

            if (!res.ok) {
                setError(data.message || 'Resplandor inválido o expirado. Verifica tu código.')
                return
            }

            // Guardamos el código y el email validados para que Login los use
            sessionStorage.setItem('destello_resplandor', codigo.trim().toUpperCase())
            navigate('/login', { state: { email: data.email, nombre: data.nombre } })

        } catch {
            setError('Sin conexión. Verifica tu internet e intenta de nuevo.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg-dark)',
            padding: 'var(--space-6)',
            boxSizing: 'border-box',
        }}>

            {/* Glow decorativo */}
            <div style={{
                position: 'fixed',
                top: '30%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 500, height: 500,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(13,115,119,0.1) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <div style={{ maxWidth: 400, width: '100%', position: 'relative', zIndex: 1 }}>

                {/* Card */}
                <div style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-2xl)',
                    padding: 'var(--space-8)',
                    boxShadow: 'var(--shadow-lg)',
                }}>

                    {/* Cabecera */}
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                        <img
                            src={logo}
                            alt="Destello"
                            style={{
                                display: 'block',
                                width: 52, height: 52,
                                objectFit: 'contain',
                                margin: '0 auto var(--space-3)',
                                filter: 'drop-shadow(0 0 12px rgba(13,115,119,0.35))',
                            }}
                        />
                        <h1 style={{
                            fontSize: 'var(--text-2xl)',
                            fontWeight: 700,
                            margin: '0 0 var(--space-2)',
                            letterSpacing: '-0.02em',
                            color: 'var(--text-primary)',
                        }}>
                            Destello
                        </h1>
                        <p style={{
                            margin: 0,
                            fontSize: 'var(--text-sm)',
                            color: 'var(--text-muted)',
                            lineHeight: 1.5,
                        }}>
                            Ingresa tu{' '}
                            <span style={{ color: 'var(--color-amber-600)', fontWeight: 600 }}>
                Resplandor
              </span>
                            {' '}de acceso para continuar
                        </p>
                    </div>

                    {/* Formulario */}
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>

                        <AccessCodeInput
                            value={codigo}
                            onChange={setCodigo}
                            error={error}
                            isLoading={isLoading}
                            placeholder="Ej. RESP-X7K2M9"
                        />

                        {/* Botón */}
                        <button
                            type="submit"
                            disabled={!btnActive}
                            onMouseEnter={() => setBtnHovered(true)}
                            onMouseLeave={() => setBtnHovered(false)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                width: '100%',
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
                                transition: 'all 0.18s ease',
                            }}
                        >
                            {isLoading ? 'Verificando tu Resplandor...' : 'Activar mi Resplandor'}
                            {!isLoading && <ArrowRight size={16} />}
                        </button>

                    </form>

                    {/* Footer */}
                    <p style={{
                        margin: 'var(--space-5) 0 0',
                        textAlign: 'center',
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-disabled)',
                    }}>
                        ¿No tienes un Resplandor?{' '}
                        <a
                            href={`https://wa.me/${WA_NUMBER}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                                color: 'var(--color-jade-500)',
                                fontWeight: 600,
                                textDecoration: 'none',
                                borderBottom: '1px solid transparent',
                                transition: 'border-color 0.18s ease',
                            }}
                            onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--color-jade-500)'}
                            onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
                        >
                            Consigue el tuyo
                        </a>
                    </p>

                </div>
            </div>
        </div>
    )
}