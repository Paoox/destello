/**
 * PageAula — El aula de clase
 * Es la pantalla principal de aprendizaje: video en vivo + visualizador 3D.
 * Por ahora muestra el layout base con placeholders.
 * El 3D viewer y el video real se integran en la siguiente fase.
 */
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  VideoCamera,
  Cube,
  ChalkboardTeacher,
  Users,
  MicrophoneSlash,
  CameraSlash,
  Phone,
  Chat,
} from '@phosphor-icons/react'

// ── Subcomponente: placeholder del video ──────────────────
function VideoPlaceholder({ label, icon: Icon, color }) {
  return (
    <div style={{
      background: '#020D0C',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-xl)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-8)',
      minHeight: 220,
    }}>
      <div style={{
        width: 56, height: 56,
        borderRadius: 'var(--radius-xl)',
        background: `${color}15`,
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={28} color={color} weight="fill" />
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
        {label}
      </p>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: 'rgba(217,119,6,0.1)',
        border: '1px solid rgba(217,119,6,0.3)',
        borderRadius: 'var(--radius-full)',
        padding: '4px 12px',
        fontSize: 'var(--text-xs)',
        color: 'var(--color-amber-600)',
        fontWeight: 500,
      }}>
        ⚡ Próximamente
      </div>
    </div>
  )
}

// ── Subcomponente: controles del aula ─────────────────────
function ControlesAula({ onSalir }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 'var(--space-3)',
      padding: 'var(--space-4)',
      background: 'var(--bg-card)',
      borderTop: '1px solid var(--border-subtle)',
    }}>
      {/* Botón micrófono */}
      <button style={{
        width: 48, height: 48,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <MicrophoneSlash size={20} />
      </button>

      {/* Botón cámara */}
      <button style={{
        width: 48, height: 48,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <CameraSlash size={20} />
      </button>

      {/* Botón chat */}
      <button style={{
        width: 48, height: 48,
        borderRadius: '50%',
        background: 'rgba(13,115,119,0.15)',
        border: '1px solid rgba(13,115,119,0.4)',
        color: 'var(--color-jade-500)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer',
      }}>
        <Chat size={20} />
      </button>

      {/* Botón salir (rojo) */}
      <button
        onClick={onSalir}
        style={{
          width: 48, height: 48,
          borderRadius: '50%',
          background: 'rgba(239,68,68,0.15)',
          border: '1px solid rgba(239,68,68,0.4)',
          color: '#EF4444',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Phone size={20} style={{ transform: 'rotate(135deg)' }} />
      </button>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────
export default function PageAula() {
  // useParams() lee el :id de la URL, ej: /aula/zen → id = "zen"
  const { id } = useParams()
  const navigate = useNavigate()

  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-dark)',
    }}>

      {/* ── Barra superior del aula ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-6)',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-subtle)',
        flexWrap: 'wrap',
      }}>
        {/* Botón volver */}
        <button
          onClick={() => navigate('/habitat')}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
          }}
        >
          <ArrowLeft size={18} /> Salir
        </button>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <h1 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
            Aula: {id || 'General'}
          </h1>
        </div>

        {/* Participantes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
          <Users size={16} />
          <span>3 participantes</span>
        </div>
      </div>

      {/* ── Contenido del aula (layout de 3 columnas en desktop) ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        // En móvil: una columna. En desktop: 2 columnas iguales + sidebar
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--space-4)',
        padding: 'var(--space-4)',
        overflow: 'auto',
      }}>

        {/* Área de video en vivo */}
        <VideoPlaceholder
          label="Video en vivo — clase con el profesor"
          icon={VideoCamera}
          color="var(--color-jade-500)"
        />

        {/* Visualizador 3D */}
        <VideoPlaceholder
          label="Visualizador 3D inmersivo"
          icon={Cube}
          color="#8B5CF6"
        />

        {/* Pizarrón interactivo */}
        <VideoPlaceholder
          label="Pizarrón interactivo colaborativo"
          icon={ChalkboardTeacher}
          color="var(--color-amber-600)"
        />

      </div>

      {/* ── Controles inferiores ── */}
      <ControlesAula onSalir={() => navigate('/habitat')} />

    </div>
  )
}
