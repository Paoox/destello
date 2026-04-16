/**
 * Page404 — Página de error "no encontrado"
 * Se muestra cuando el usuario entra a una URL que no existe.
 * React Router la muestra con la ruta path="*" en App.jsx.
 */
import { useNavigate } from 'react-router-dom'
import { Sparkle, ArrowLeft, HouseSimple } from '@phosphor-icons/react'

export default function Page404() {
  const navigate = useNavigate()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-dark)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--space-6)',
      textAlign: 'center',
    }}>

      {/* Número 404 grande decorativo */}
      <div style={{
        fontSize: 'clamp(5rem, 20vw, 10rem)',
        fontWeight: 700,
        letterSpacing: '-0.05em',
        lineHeight: 1,
        marginBottom: 'var(--space-4)',
        // Gradiente de texto
        background: 'linear-gradient(135deg, rgba(13,115,119,0.3), rgba(13,115,119,0.05))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        userSelect: 'none',
      }}>
        404
      </div>

      {/* Ícono */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <Sparkle size={36} color="var(--color-jade-500)" weight="fill" />
      </div>

      {/* Mensaje */}
      <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>
        Esta página no existe
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: 'var(--space-8)', maxWidth: 380 }}>
        La dirección que buscas no está disponible. Quizás fue movida o el enlace está mal escrito.
      </p>

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} /> Volver
        </button>

        <button
          onClick={() => navigate('/home')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: 'var(--space-3) var(--space-5)',
            background: 'var(--color-jade-500)',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            color: '#FAF7F2',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <HouseSimple size={16} /> Ir al inicio
        </button>
      </div>
    </div>
  )
}
