/**
 * PageIntro — Pantalla de bienvenida animada
 * Secuencia: logo aparece con fade → nombre letra por letra → slogan.
 * Detecta preferencia de color del sistema (claro/oscuro) para elegir logo.
 * Duración total ~5 segundos.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'

const NOMBRE = 'Destello'
// Tiempos (ms)
const LOGO_FADE_DURATION   = 1000   // el logo tarda 1s en aparecer
const LOGO_HOLD            = 400    // pausa antes de que empiece el nombre
const LETTER_INTERVAL      = 180    // cada letra aparece 180ms después
const SLOGAN_DELAY_AFTER   = 400    // pausa tras última letra antes del slogan

export default function PageIntro() {
  const navigate = useNavigate()

  // Detectar modo oscuro del sistema
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const logo = prefersDark ? logoDark : logoLight

  const [logoVisible,   setLogoVisible]   = useState(false)
  const [lettersShown,  setLettersShown]  = useState(0)   // cuántas letras ya aparecieron
  const [sloganVisible, setSloganVisible] = useState(false)

  useEffect(() => {
    const timers = []

    // 1. Logo entra con fade
    timers.push(setTimeout(() => setLogoVisible(true), 600))

    // 2. Empezar a mostrar letras después de LOGO_FADE_DURATION + LOGO_HOLD
    const letraStart = LOGO_FADE_DURATION + LOGO_HOLD
    NOMBRE.split('').forEach((_, i) => {
      timers.push(
          setTimeout(() => setLettersShown(i + 1), letraStart + i * LETTER_INTERVAL)
      )
    })

    // 3. Slogan aparece después de la última letra
    const sloganStart = letraStart + NOMBRE.length * LETTER_INTERVAL + SLOGAN_DELAY_AFTER
    timers.push(setTimeout(() => setSloganVisible(true), sloganStart))

    // 4. Navegar al login automáticamente (~5.5s desde inicio)
    timers.push(setTimeout(() => navigate('/login'), sloganStart + 1800))

    return () => timers.forEach(clearTimeout)
  }, [navigate])

  return (
      <div style={{
        minHeight: '100vh',
        background: prefersDark ? 'var(--bg-dark)' : '#F5F5F0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* ── Glow decorativo principal ── */}
        <div style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '640px',
          height: '640px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(13,115,119,0.14) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ── Glow secundario ── */}
        <div style={{
          position: 'absolute',
          bottom: '20%',
          right: '20%',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(217,119,6,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* ── Contenido centrado ── */}
        <div style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--space-6)',
        }}>

          {/* Logo real */}
          <img
              src={logo}
              alt="Destello logo"
              style={{
                width: 100,
                height: 100,
                objectFit: 'contain',
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
            fontWeight: 700,
            letterSpacing: '-0.04em',
            margin: 0,
            lineHeight: 1,
            minHeight: '1.2em',
          }}>
            {NOMBRE.split('').map((letra, i) => (
                <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      opacity: lettersShown > i ? 1 : 0,
                      transform: lettersShown > i ? 'translateY(0)' : 'translateY(12px)',
                      transition: 'opacity 0.50s ease, transform 0.50s ease',
                      // Color sólido: claro en fondo oscuro, oscuro en fondo claro
                      color: prefersDark ? '#FAF7F2' : '#1a1a1a',
                      // Color jade en la última letra del nombre
                      ...(i === NOMBRE.length - 1 && { color: '#0F9EA4' }),
                    }}
                >
      {letra}
    </span>
            ))}
          </h1>

          {/* Slogan */}
          <p style={{
            fontSize: 'var(--text-lg)',
            color: prefersDark ? 'var(--text-muted)' : '#555',
            margin: 0,
            lineHeight: 1.6,
            opacity: sloganVisible ? 1 : 0,
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