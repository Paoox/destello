/**
 * PageHabitat — Catálogo de talleres
 * Carga los talleres activos desde la API.
 * Cada taller tiene un botón "Quiero mi Chispa" → modal de registro en lista de espera.
 */
import { useState, useEffect }      from 'react'
import { useNavigate }              from 'react-router-dom'
import {
  GlobeHemisphereWest, ArrowRight, Lock,
  Sparkle, X, CheckCircle, WhatsappLogo,
} from '@phosphor-icons/react'
import { apiListTalleres, apiUnirseListaEspera } from '@services/publicApi.js'

const CATEGORIA_COLOR = {
  'Horizonte Zen':    '#0D7377',
  'Bienestar':        '#0D7377',
  'Arte':             '#8B5CF6',
  'Taller Creativo':  '#8B5CF6',
  'Gastronomía':      '#10B981',
  'Cocina':           '#D97706',
  'Habilidades':      '#EC4899',
  'Superación':       '#EC4899',
}
function colorParaCategoria(cat) {
  if (!cat) return '#0D7377'
  for (const [k, v] of Object.entries(CATEGORIA_COLOR)) {
    if (cat.toLowerCase().includes(k.toLowerCase())) return v
  }
  return '#0D7377'
}

// ── Modal de registro ──────────────────────────────────────────────────────────
function ModalChispa({ taller, onClose }) {
  const [nombre,    setNombre]    = useState('')
  const [email,     setEmail]     = useState('')
  const [whatsapp,  setWhatsapp]  = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState(null)
  const [exito,     setExito]     = useState(false)
  const [yaRegistrado, setYaRegistrado] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await apiUnirseListaEspera(taller.id, {
        email:    email.trim().toLowerCase(),
        nombre:   nombre.trim() || undefined,
        whatsapp: whatsapp.trim() || undefined,
      })
      if (data.nuevo) {
        setExito(true)
      } else {
        setYaRegistrado(true)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
      <div
          style={{
            position:   'fixed', inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display:    'flex', alignItems: 'center', justifyContent: 'center',
            zIndex:     1000, padding: 'var(--space-6)',
          }}
          onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <div style={{
          background:   'var(--bg-card)',
          border:       '1px solid var(--border-default)',
          borderRadius: 'var(--radius-2xl)',
          padding:      'var(--space-7)',
          maxWidth:     440, width: '100%',
          position:     'relative',
          boxShadow:    'var(--shadow-lg)',
        }}>
          <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 'var(--space-4)', right: 'var(--space-4)',
                background: 'none', border: 'none',
                color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
              }}
          >
            <X size={18} />
          </button>

          {exito || yaRegistrado ? (
              /* ── Estado de éxito ── */
              <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                <CheckCircle size={44} weight="fill" color="#22c55e" style={{ marginBottom: 'var(--space-3)' }} />
                <h3 style={{ fontWeight: 700, marginBottom: 'var(--space-2)' }}>
                  {yaRegistrado ? '¡Ya estás en la lista!' : '¡Listo, te anotamos!'}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>
                  {yaRegistrado
                      ? `Ya tienes un lugar reservado en "${taller.nombre}". Te avisaremos cuando tu Chispa esté lista.`
                      : `Te registramos en la lista de espera de "${taller.nombre}". En cuanto haya lugar, te enviamos tu Chispa.`
                  }
                </p>
                <button
                    onClick={onClose}
                    style={{
                      marginTop:    'var(--space-5)',
                      padding:      'var(--space-3) var(--space-6)',
                      background:   'var(--color-jade-500)',
                      border:       'none',
                      borderRadius: 'var(--radius-lg)',
                      color:        '#FAF7F2',
                      fontWeight:   600,
                      fontSize:     'var(--text-sm)',
                      cursor:       'pointer',
                      fontFamily:   'var(--font-sans)',
                    }}
                >
                  Perfecto
                </button>
              </div>
          ) : (
              /* ── Formulario ── */
              <>
                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-2)' }}>
                    <Sparkle size={18} color="var(--color-jade-500)" weight="fill" />
                    <h3 style={{ fontWeight: 700, fontSize: 'var(--text-lg)', margin: 0 }}>
                      Quiero mi Chispa
                    </h3>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', margin: 0, lineHeight: 1.5 }}>
                    Aparta tu lugar en{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{taller.nombre}</strong>.
                    Te avisamos cuando esté disponible.
                  </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <div>
                    <label style={labelStyle}>Nombre</label>
                    <input
                        type="text" placeholder="Tu nombre"
                        value={nombre} onChange={e => setNombre(e.target.value)}
                        style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Email *</label>
                    <input
                        type="email" placeholder="tu@correo.com"
                        value={email} onChange={e => setEmail(e.target.value)}
                        style={inputStyle} required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>
                      <WhatsappLogo size={12} style={{ marginRight: 4 }} color="#25D366" />
                      WhatsApp (opcional)
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                                    <span style={{
                                      padding:      'var(--space-3)',
                                      background:   'var(--bg-surface)',
                                      border:       '1px solid var(--border-default)',
                                      borderRadius: 'var(--radius-lg)',
                                      fontSize:     'var(--text-sm)',
                                      color:        'var(--text-muted)',
                                      whiteSpace:   'nowrap',
                                    }}>+52</span>
                      <input
                          type="tel" placeholder="10 dígitos"
                          maxLength={10}
                          value={whatsapp} onChange={e => setWhatsapp(e.target.value.replace(/\D/g, ''))}
                          style={{ ...inputStyle, flex: 1 }}
                      />
                    </div>
                  </div>

                  {error && (
                      <p style={{ color: 'var(--color-error)', fontSize: 'var(--text-xs)', margin: 0 }}>
                        {error}
                      </p>
                  )}

                  <button
                      type="submit"
                      disabled={loading || !email.trim()}
                      style={{
                        padding:      'var(--space-3)',
                        background:   loading || !email.trim() ? 'var(--bg-surface)' : 'var(--color-jade-500)',
                        border:       '1px solid transparent',
                        borderRadius: 'var(--radius-lg)',
                        color:        loading || !email.trim() ? 'var(--text-muted)' : '#FAF7F2',
                        fontFamily:   'var(--font-sans)',
                        fontWeight:   600,
                        fontSize:     'var(--text-sm)',
                        cursor:       loading || !email.trim() ? 'not-allowed' : 'pointer',
                        transition:   'background 0.18s ease',
                      }}
                  >
                    {loading ? 'Anotando...' : '✦ Aparta mi lugar'}
                  </button>
                </form>
              </>
          )}
        </div>
      </div>
  )
}

// ── Tarjeta de taller ─────────────────────────────────────────────────────────
function TallerCard({ taller, onQuieroChispa }) {
  const navigate = useNavigate()
  const color    = colorParaCategoria(taller.categoria)
  const activo   = taller.estado === 'activo'

  return (
      <div style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
        padding:      'var(--space-5)',
        opacity:      activo ? 1 : 0.55,
        position:     'relative', overflow: 'hidden',
        display:      'flex', flexDirection: 'column', gap: 'var(--space-3)',
        transition:   'border-color 0.2s',
      }}
           onMouseEnter={e => activo && (e.currentTarget.style.borderColor = color)}
           onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
      >
        {/* Glow */}
        <div style={{
          position: 'absolute', top: -20, right: -20,
          width: 100, height: 100, borderRadius: '50%',
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        {/* Icono + estado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--radius-lg)',
            background: `${color}20`, border: `1px solid ${color}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GlobeHemisphereWest size={22} color={color} weight="fill" />
          </div>
          {!activo && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 'var(--radius-full)',
                padding: '4px 10px',
                fontSize: 'var(--text-xs)', color: 'var(--text-muted)',
              }}>
                        <Lock size={12} /> Próximamente
                    </span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1 }}>
          {taller.categoria && (
              <p style={{ fontSize: 'var(--text-xs)', color, fontWeight: 600, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {taller.categoria}
              </p>
          )}
          <h3 style={{ fontWeight: 600, fontSize: 'var(--text-base)', margin: '0 0 4px' }}>
            {taller.nombre}
          </h3>
          {taller.descripcion && (
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', margin: 0, lineHeight: 1.5 }}>
                {taller.descripcion}
              </p>
          )}
        </div>

        {/* Meta */}
        {(taller.horario || taller.precio != null) && (
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
              {taller.horario && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            🕐 {taller.horario}
                        </span>
              )}
              {taller.precio != null && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            💰 ${Number(taller.precio).toLocaleString('es-MX')} MXN
                        </span>
              )}
            </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'auto' }}>
          {activo ? (
              <button
                  onClick={() => onQuieroChispa(taller)}
                  style={{
                    flex:         1,
                    display:      'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    padding:      'var(--space-3)',
                    background:   `${color}22`,
                    border:       `1px solid ${color}66`,
                    borderRadius: 'var(--radius-lg)',
                    color,
                    fontFamily:   'var(--font-sans)',
                    fontWeight:   600,
                    fontSize:     'var(--text-sm)',
                    cursor:       'pointer',
                    transition:   'background 0.18s ease',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = `${color}33`)}
                  onMouseLeave={e => (e.currentTarget.style.background = `${color}22`)}
              >
                <Sparkle size={14} weight="fill" />
                Quiero mi Chispa
              </button>
          ) : (
              <button disabled style={{
                flex: 1, padding: 'var(--space-3)',
                background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)', color: 'var(--text-disabled)',
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 'var(--text-sm)',
                cursor: 'not-allowed',
              }}>
                Próximamente
              </button>
          )}
        </div>
      </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function PageHabitat() {
  const [talleres,      setTalleres]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [tallerModal,   setTallerModal]   = useState(null) // taller seleccionado para modal

  useEffect(() => {
    apiListTalleres()
        .then(data => setTalleres(data.tallers ?? []))
        .catch(err  => setError(err.message))
        .finally(()  => setLoading(false))
  }, [])

  return (
      <div style={{ padding: 'var(--space-8)', maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, letterSpacing: '-0.02em' }}>
            Talleres
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4 }}>
            Elige el que más te llame — aparta tu lugar y te enviamos tu Chispa cuando esté disponible
          </p>
        </div>

        {/* Estado de carga */}
        {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)' }}>
              <div style={{
                width: 32, height: 32,
                border: '3px solid var(--border-subtle)',
                borderTopColor: 'var(--color-jade-500)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
        )}

        {error && (
            <div style={{
              padding: 'var(--space-6)', textAlign: 'center',
              color: 'var(--color-error)', fontSize: 'var(--text-sm)',
            }}>
              No se pudieron cargar los talleres. Intenta de nuevo más tarde.
            </div>
        )}

        {/* Grid de talleres */}
        {!loading && !error && talleres.length === 0 && (
            <div style={{ textAlign: 'center', padding: 'var(--space-16)', color: 'var(--text-muted)' }}>
              No hay talleres disponibles por el momento. ¡Vuelve pronto!
            </div>
        )}

        {!loading && talleres.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: 'var(--space-4)',
            }}>
              {talleres.map(t => (
                  <TallerCard
                      key={t.id}
                      taller={t}
                      onQuieroChispa={setTallerModal}
                  />
              ))}
            </div>
        )}

        {/* Modal */}
        {tallerModal && (
            <ModalChispa
                taller={tallerModal}
                onClose={() => setTallerModal(null)}
            />
        )}
      </div>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const labelStyle = {
  display: 'block', fontSize: 'var(--text-xs)',
  color: 'var(--text-muted)', marginBottom: 4, fontWeight: 500,
}

const inputStyle = {
  width: '100%', padding: 'var(--space-3)',
  background: 'var(--bg-surface)', border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)',
  fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
  outline: 'none', boxSizing: 'border-box',
}