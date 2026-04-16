/**
 * PagePerfil — Perfil del usuario
 * Muestra información del alumno: foto, nombre, progreso en talleres,
 * logros obtenidos y configuración básica.
 */
import { useState } from 'react'
import {
  UserCircle,
  PencilSimple,
  Trophy,
  Star,
  Fire,
  CheckCircle,
  Clock,
  Certificate,
} from '@phosphor-icons/react'

// ── Datos del perfil (después vendrán del backend) ─────────
const PERFIL_MOCK = {
  nombre: 'Estudiante Destello',
  email: 'alumno@destello.app',
  rol: 'Alumna',
  racha: 7,
  puntos: 340,
  logros: 12,
  talleres: [
    { nombre: 'Auriculoterapia Nivel 1', progreso: 65, completadas: 8, total: 12 },
    { nombre: 'Automaquillaje Artístico', progreso: 30, completadas: 3, total: 10 },
    { nombre: 'Elaboración de Gomitas',  progreso: 10, completadas: 1, total: 8  },
    { nombre: 'Dibujo Expresivo',        progreso: 80, completadas: 8, total: 10 },
  ],
}

// ── Subcomponente: tarjeta de stat ────────────────────────
function StatCard({ icon: Icon, valor, label, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      padding: 'var(--space-4)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', gap: 'var(--space-2)',
      textAlign: 'center',
    }}>
      <Icon size={28} color={color} weight="fill" />
      <span style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{valor}</span>
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  )
}

// ── Subcomponente: fila de taller ─────────────────────────
function TallerFila({ taller }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--space-4)',
      padding: 'var(--space-4)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      {/* Ícono de estado */}
      <div style={{ flexShrink: 0 }}>
        {taller.progreso === 100
          ? <CheckCircle size={24} color="var(--color-success)" weight="fill" />
          : <Clock size={24} color="var(--color-jade-500)" weight="regular" />
        }
      </div>

      {/* Info del taller */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500, fontSize: 'var(--text-sm)', marginBottom: 6,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {taller.nombre}
        </div>
        {/* Barra de progreso */}
        <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)' }}>
          <div style={{
            height: '100%',
            width: `${taller.progreso}%`,
            background: 'var(--color-jade-500)',
            borderRadius: 'var(--radius-full)',
          }} />
        </div>
      </div>

      {/* Texto: clases completadas */}
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', flexShrink: 0 }}>
        {taller.completadas}/{taller.total} clases
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────
export default function PagePerfil() {
  const [editando, setEditando] = useState(false)
  const perfil = PERFIL_MOCK

  return (
    <div style={{
      padding: 'var(--space-8)',
      maxWidth: 800,
      margin: '0 auto',
    }}>

      {/* ── Tarjeta de perfil ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-2xl)',
        padding: 'var(--space-6)',
        marginBottom: 'var(--space-6)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-6)',
        flexWrap: 'wrap',
        position: 'relative',
      }}>

        {/* Avatar */}
        <div style={{
          width: 90, height: 90,
          borderRadius: '50%',
          background: 'rgba(13,115,119,0.15)',
          border: '3px solid var(--color-jade-500)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 0 20px rgba(13,115,119,0.3)',
        }}>
          <UserCircle size={56} color="var(--color-jade-500)" weight="fill" />
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
            <h1 style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>
              {perfil.nombre}
            </h1>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginBottom: 4 }}>
            {perfil.email}
          </p>
          <div style={{
            display: 'inline-block',
            background: 'rgba(13,115,119,0.15)',
            border: '1px solid rgba(13,115,119,0.4)',
            borderRadius: 'var(--radius-full)',
            padding: '2px 12px',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-jade-500)',
            fontWeight: 600,
          }}>
            {perfil.rol}
          </div>
        </div>

        {/* Botón editar */}
        <button
          onClick={() => setEditando(!editando)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-muted)',
            fontSize: 'var(--text-sm)',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <PencilSimple size={16} />
          Editar
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}>
        <StatCard icon={Fire}   valor={`${perfil.racha}🔥`} label="Racha de días"    color="#F59E0B" />
        <StatCard icon={Star}   valor={perfil.puntos}        label="Puntos totales"   color="var(--color-jade-500)" />
        <StatCard icon={Trophy} valor={perfil.logros}        label="Logros obtenidos" color="#D97706" />
      </div>

      {/* ── Progreso en talleres ── */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        marginBottom: 'var(--space-6)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          padding: 'var(--space-4) var(--space-5)',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          <Certificate size={20} color="var(--color-jade-500)" weight="fill" />
          <h2 style={{ fontWeight: 600, fontSize: 'var(--text-base)' }}>Mis talleres</h2>
        </div>
        {perfil.talleres.map(t => (
          <TallerFila key={t.nombre} taller={t} />
        ))}
      </div>

    </div>
  )
}
