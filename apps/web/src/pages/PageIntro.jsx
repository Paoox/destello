/**
 * PageIntro — Pantalla de bienvenida animada
 * Secuencia: logo → nombre letra por letra → slogan (~5s).
 * El modo claro/oscuro lo maneja tokens.css automáticamente.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'

const NOMBRE             = 'Destello'
const LOGO_FADE_DURATION = 1000
const LOGO_HOLD          = 400
const LETTER_INTERVAL    = 180
const SLOGAN_DELAY_AFTER = 400

export default function PageIntro() {
    const navigate = useNavigate()

    // Solo se necesita para elegir la imagen — el CSS maneja el resto
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const logo = prefersDark ? logoDark : logoLight

    const [logoVisible,   setLogoVisible]   = useState(false)
    const [lettersShown,  setLettersShown]  = useState(0)
    const [sloganVisible, setSloganVisible] = useState(false)

    useEffect(() => {
        const timers = []

        timers.push(setTimeout(() => setLogoVisible(true), 600))

        const letraStart = LOGO_FADE_DURATION + LOGO_HOLD
        NOMBRE.split('').forEach((_, i) => {
            timers.push(setTimeout(() => setLettersShown(i + 1), letraStart + i * LETTER_INTERVAL))
        })

        const sloganStart = letraStart + NOMBRE.length * LETTER_INTERVAL + SLOGAN_DELAY_AFTER
        timers.push(setTimeout(() => setSloganVisible(true), sloganStart))
        timers.push(setTimeout(() => navigate('/bienvenida'), sloganStart + 1800))

        return () => timers.forEach(clearTimeout)
    }, [navigate])

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-dark)',      // ← tokens.css lo adapta solo
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6)',
            position: 'relative',
            overflow: 'hidden',
        }}>

            {/* Glow principal */}
            <div style={{
                position: 'absolute', top: '30%', left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '640px', height: '640px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(13,115,119,0.14) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            {/* Glow secundario */}
            <div style={{
                position: 'absolute', bottom: '20%', right: '20%',
                width: '320px', height: '320px', borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(217,119,6,0.07) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            {/* Contenido */}
            <div style={{
                position: 'relative', zIndex: 1, textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 'var(--space-6)',
            }}>

                {/* Logo */}
                <img
                    src={logo}
                    alt="Destello logo"
                    style={{
                        width: 100, height: 100, objectFit: 'contain',
                        opacity: logoVisible ? 1 : 0,
                        transform: logoVisible ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(10px)',
                        transition: `opacity ${LOGO_FADE_DURATION}ms cubic-bezier(0.4,0,0.2,1),
                         transform ${LOGO_FADE_DURATION}ms cubic-bezier(0.4,0,0.2,1)`,
                        filter: 'drop-shadow(0 0 24px rgba(13,115,119,0.45))',
                    }}
                />

                {/* Nombre letra por letra */}
                <h1 style={{
                    fontSize: 'clamp(2.8rem, 9vw, 4.5rem)',
                    fontWeight: 700, letterSpacing: '-0.04em',
                    margin: 0, lineHeight: 1, minHeight: '1.2em',
                }}>
                    {NOMBRE.split('').map((letra, i) => (
                        <span key={i} style={{
                            display: 'inline-block',
                            opacity:   lettersShown > i ? 1 : 0,
                            transform: lettersShown > i ? 'translateY(0)' : 'translateY(12px)',
                            transition: 'opacity 0.50s ease, transform 0.50s ease',
                            color: i === NOMBRE.length - 1
                                ? '#0F9EA4'               // última letra siempre jade
                                : 'var(--text-primary)',  // ← tokens.css lo adapta solo
                        }}>
              {letra}
            </span>
                    ))}
                </h1>

                {/* Slogan */}
                <p style={{
                    fontSize: 'var(--text-lg)',
                    color: 'var(--text-muted)',     // ← tokens.css lo adapta solo
                    margin: 0, lineHeight: 1.6,
                    opacity:   sloganVisible ? 1 : 0,
                    transform: sloganVisible ? 'translateY(0)' : 'translateY(8px)',
                    transition: 'opacity 0.7s ease, transform 0.7s ease',
                }}>
                    Aprende con experiencias que{' '}
                    <span style={{ color: 'var(--color-amber-600)', fontWeight: 600 }}>
            no olvidarás
          </span>
                </p>

            </div>
        </div>
    )
}