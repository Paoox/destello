/**
 * PageHabitat — Espacio de gamificación
 * Aquí el usuario tiene su avatar, logros y puede explorar
 * los espacios virtuales de aprendizaje (Habitat).
 * Por ahora es la versión base — se expande con el 3D viewer después.
 */
import { useNavigate } from 'react-router-dom'
import {
  GlobeHemisphereWest,
  Trophy,
  Star,
  Lock,
  ArrowRight,
  UserCircle,
} from '@phosphor-icons/react'

// ── Datos de los espacios disponibles ─────────────────────
// Cuando haya más espacios, solo agregas objetos a este array
const ESPACIOS = [
  {
    id: 'zen',
    nombre: 'Horizonte Zen',
    descripcion: 'Bienestar, auriculoterapia y medicina tradicional',
    color: '#0D7377',
    desbloqueado: true,
    progreso: 65,
  },
  {
    id: 'arte',
    nombre: 'Taller Creativo',
    descripcion: 'Dibujo, diseño y expresión artística',
    color: '#8B5CF6',
    desbloqueado: true,
    progreso: 30,
  },
  {
    id: 'cocina',
    nombre: 'La Cocina',
    descripcion: 'Gastronomía y elaboración de productos',
    color: '#D97706',
    desbloqueado: true,
    progreso: 10,
  },
  {
    id: 'personal',
    nombre: 'Superación Personal',
    descripcion: 'Amor propio, motivación y desarrollo personal',
    color: '#EC4899',
    desbloqueado: false, // bloqueado — próximamente
    progreso: 0,
  },
]

// ── Subcomponente: tarjeta de espacio ─────────────────────
function EspacioCard({ espacio }) {
  const navigate = useNavigate()

  return (
    <div
      onClick={() => espacio.desbloqueado && navigate(`/aula/${espacio.id}`)}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${espacio.desbloqueado ? 'var(--border-subtle)' : 'transparent'}`,
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        cursor: espacio.desbloqueado ? 'pointer' : 'not-allowed',
        opacity: espacio.desbloqueado ? 1 : 0.5,
        transition: 'border-color 0.2s, transform 0.2s',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        if (espacio.desbloqueado) e.currentTarget.style.borderColor = espacio.color
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-subtle)'
      }}
    >
      {/* Glow de color del espacio */}
      <div style={{
        position: 'absolute',
        top: -20, right: -20,
        width: 100, height: 100,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${espacio.color}20 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header de la tarjeta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
        <div style={{
          width: 44, height: 44,
          borderRadius: 'var(--radius-lg)',
          background: `${espacio.color}20`,
          border: `1px solid ${espacio.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <GlobeHemisphereWest size={22} color={espacio.color} weight="fill" />
        </div>

        {/* Candado si está bloqueado */}
        {!espacio.desbloqueado && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 'var(--radius-full)',
            padding: '4px 10px',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}>
            <Lock size={12} /> Próximamente
          </div>
        )}

        {/* Flecha si está desbloqueado */}
        {espacio.desbloqueado && (
          <ArrowRight size={18} color="var(--text-muted)" />
        )}
      </div>

      {/* Nombre y descripción */}
      <h3 style={{ fontWeight: 600, fontSize: 'var(--text-base)', marginBottom: 4 }}>
        {espacio.nombre}
      </h3>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
        {espacio.descripcion}
      </p>

      {/* Barra de progreso (solo si está desbloqueado) */}
      {espacio.desbloqueado && (
        <div>
          <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)' }}>
            <div style={{
              height: '100%',
              width: `${espacio.progreso}%`,
              background: espacio.color,
              borderRadius: 'var(--radius-full)',
              transition: 'width 0.5s ease',
            }} />
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6 }}>
            {espacio.progreso}% explorado
          </p>
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────
export default function PageHabitat() {
  return (
    <div style={{
      padding: 'var(--space-8)',
      maxWidth: 1100,
      margin: '0 auto',
    }}>

      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
          Mi Habitat
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
          Explora tus espacios de aprendizaje y sigue tu progreso
        </p>
      </div>

      {/* Sección del avatar — placeholder por ahora */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-6)',
        marginBottom: 'var(--space-8)',
        flexWrap: 'wrap',
      }}>
        {/* Avatar placeholder */}
        <div style={{
          width: 80, height: 80,
          borderRadius: '50%',
          background: 'rgba(13,115,119,0.15)',
          border: '2px solid var(--color-jade-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <UserCircle size={48} color="var(--color-jade-500)" weight="fill" />
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ fontWeight: 600, fontSize: 'var(--text-xl)' }}>Mi Avatar</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            La personalización del avatar estará disponible pronto ✨
          </p>
        </div>

        {/* Logros rápidos */}
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-amber-600)' }}>
              <Trophy size={20} weight="fill" />
              <span style={{ fontWeight: 700, fontSize: 'var(--text-xl)' }}>12</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Logros</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--color-jade-500)' }}>
              <Star size={20} weight="fill" />
              <span style={{ fontWeight: 700, fontSize: 'var(--text-xl)' }}>340</span>
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Puntos</div>
          </div>
        </div>
      </div>

      {/* Grid de espacios */}
      <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
        Espacios disponibles
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
        gap: 'var(--space-4)',
      }}>
        {ESPACIOS.map(espacio => (
          <EspacioCard key={espacio.id} espacio={espacio} />
        ))}
      </div>
    </div>
  )
}
