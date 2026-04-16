/**
 * PageIntro — Pantalla de bienvenida animada
 * Es la primera pantalla que ve el usuario al entrar a Destello.
 * Muestra el logo, una frase motivadora y el botón para ir al login.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkle, ArrowRight } from '@phosphor-icons/react'

export default function PageIntro() {
  const navigate = useNavigate()

  // Estado para controlar la animación de entrada
  // Empieza invisible y después de 100ms aparece con fade-in
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Pequeño delay para que la animación se vea suave
    const timer = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* ── Fondo decorativo: círculo de glow verde ── */}
      <div style={{
        position: 'absolute',
        top: '30%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(13,115,119,0.15) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Segundo glow más pequeño abajo ── */}
      <div style={{
        position: 'absolute',
        bottom: '20%',
        right: '20%',
        width: '300px',
        height: '300px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217,119,6,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* ── Contenido principal (se anima con fade-in) ── */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        textAlign: 'center',
        maxWidth: '520px',
        // La opacidad cambia de 0 a 1 y sube un poco con transform
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.7s ease, transform 0.7s ease',
      }}>

        {/* Ícono del logo */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 80,
          height: 80,
          borderRadius: '24px',
          background: 'rgba(13,115,119,0.12)',
          border: '1px solid rgba(13,115,119,0.4)',
          marginBottom: 'var(--space-6)',
          boxShadow: '0 0 40px rgba(13,115,119,0.3)',
        }}>
          <Sparkle size={40} weight="fill" color="var(--color-jade-500)" />
        </div>

        {/* Nombre */}
        <h1 style={{
          fontSize: 'clamp(2.5rem, 8vw, 4rem)',
          fontWeight: 700,
          letterSpacing: '-0.04em',
          marginBottom: 'var(--space-3)',
          // Gradiente de texto: jade → blanco
          background: 'linear-gradient(135deg, #FAF7F2 30%, #0F9EA4 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          destello
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: 'var(--text-lg)',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-10)',
          lineHeight: 1.6,
        }}>
          Aprende con experiencias que{' '}
          <span style={{ color: 'var(--color-amber-600)', fontWeight: 600 }}>
            no olvidarás
          </span>
        </p>

        {/* Botón principal para ir al login */}
        <button
          onClick={() => navigate('/login')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-4) var(--space-8)',
            background: 'var(--color-jade-500)',
            border: 'none',
            borderRadius: 'var(--radius-full)',
            color: '#FAF7F2',
            fontSize: 'var(--text-base)',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            boxShadow: '0 0 30px rgba(13,115,119,0.4)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.04)'
            e.currentTarget.style.boxShadow = '0 0 40px rgba(13,115,119,0.6)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.boxShadow = '0 0 30px rgba(13,115,119,0.4)'
          }}
        >
          Comenzar
          <ArrowRight size={20} weight="bold" />
        </button>

        {/* Texto pequeño debajo */}
        <p style={{
          marginTop: 'var(--space-5)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-disabled)',
        }}>
          Plataforma de aprendizaje inmersivo 3D
        </p>
      </div>
    </div>
  )
}
