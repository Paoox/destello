/**
 * Destello — PageHome
 * Landing principal después del login.
 * Muestra talleres disponibles, progreso y accesos rápidos.
 */
import { Books, PlayCircle, Trophy, ArrowRight, Fire } from '@phosphor-icons/react'

// ── Subcomponente: Stat card ──────────────────────────────
function StatCard({ Icon, label, value, accent }) {
  return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-5)',
        display: 'flex', alignItems: 'center', gap: 'var(--space-4)',
      }}>
        <div style={{
          width: 44, height: 44,
          background: accent === 'amber' ? 'rgba(217,119,6,0.12)' : 'rgba(13,115,119,0.12)',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Icon size={22} color={accent === 'amber' ? 'var(--color-amber-600)' : 'var(--color-jade-500)'} weight="fill" />
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{value}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{label}</div>
        </div>
      </div>
  )
}

// ── Subcomponente: Taller card ────────────────────────────
function TallerCard({ title, category, progress, imgColor }) {
  return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        transition: 'border-color 0.2s, transform 0.2s',
        cursor: 'pointer',
      }}>
        {/* Thumbnail placeholder */}
        <div style={{
          height: 120,
          background: `linear-gradient(135deg, ${imgColor}22, ${imgColor}44)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <PlayCircle size={40} color={imgColor} weight="fill" />
        </div>
        {/* Info */}
        <div style={{ padding: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-amber-600)', fontWeight: 600, marginBottom: 4 }}>
            {category}
          </div>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', marginBottom: 'var(--space-3)' }}>
            {title}
          </div>
          {/* Progress bar */}
          <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 'var(--radius-full)' }}>
            <div style={{
              height: '100%',
              width: `${progress}%`,
              background: 'var(--color-jade-500)',
              borderRadius: 'var(--radius-full)',
            }} />
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
            {progress}% completado
          </div>
        </div>
      </div>
  )
}

// ── Página ────────────────────────────────────────────────
const TALLERES = [
  { title: 'Auriculoterapia Nivel 1', category: 'Horizonte Zen', progress: 65, imgColor: '#0D7377' },
  { title: 'Automaquillaje Artístico', category: 'Estilo Personal', progress: 30, imgColor: '#D97706' },
  { title: 'Elaboración de Gomitas', category: 'Gastronomía', progress: 10, imgColor: '#10B981' },
  { title: 'Dibujo Expresivo', category: 'Arte', progress: 80, imgColor: '#8B5CF6' },
]

export default function PageHome() {
  return (
      <div style={{
        padding: 'var(--space-8)',
        maxWidth: 1100,
        width: '100%',
        margin: '0 auto',
      }}>
        {/* Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Buen día ✨
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Continúa donde lo dejaste
          </p>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)',
        }}>
          <StatCard Icon={Books}   label="Talleres activos" value="4"    accent="jade" />
          <StatCard Icon={Trophy}  label="Logros obtenidos" value="12"   accent="amber" />
          <StatCard Icon={Fire}    label="Racha de días"    value="7 🔥"  accent="amber" />
        </div>

        {/* Talleres */}
        <div style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>Mis talleres</h2>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', color: 'var(--color-jade-500)',
            fontSize: 'var(--text-sm)', fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}>
            Ver todos <ArrowRight size={14} />
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 'var(--space-4)',
        }}>
          {TALLERES.map((t) => (
              <TallerCard key={t.title} {...t} />
          ))}
        </div>
      </div>
  )
}