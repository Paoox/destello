/**
 * PageLanding — /bienvenida
 * Landing pública. Llega después del intro.
 * CTAs: conseguir Chispa (WhatsApp) o activar Chispa (/acceso)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
    Sparkle, Lightning, Users, BookOpen,
    GlobeHemisphereWest, ArrowRight, WhatsappLogo,
    Star, Cube, VideoCamera,
} from '@phosphor-icons/react'
import logoLight from '../Images/destello-logo-512.png'
import logoDark  from '../Images/destello-logo-dark-512.png'

const WA_NUMBER = 'TU_NUMERO_AQUI'  // ← reemplaza con tu número

// ── Stats globales ────────────────────────────────────────────
const STATS = [
    { value: '40+',   label: 'Talleres disponibles',  Icon: BookOpen },
    { value: '1,200', label: 'Alumnos registrados',   Icon: Users },
    { value: '8',     label: 'Próximos talleres',      Icon: VideoCamera },
    { value: '12',    label: 'Países alcanzados',      Icon: GlobeHemisphereWest },
]

// ── Pilares de metodología ────────────────────────────────────
const PILARES = [
    {
        Icon: Cube,
        titulo: 'Aulas 3D en vivo',
        texto: 'Entra a un espacio inmersivo diseñado para que aprendas haciendo. No videos grabados, clases reales en tiempo real.',
        acento: 'jade',
    },
    {
        Icon: Lightning,
        titulo: 'Gamificación real',
        texto: 'Gana puntos, desbloquea logros y sube de nivel conforme avanzas. Aprender se convierte en algo que quieres hacer cada día.',
        acento: 'amber',
    },
    {
        Icon: Star,
        titulo: 'Maestros expertos',
        texto: 'Cada taller es impartido por profesionales con años de experiencia. Aprende de quienes ya viven de lo que enseñan.',
        acento: 'jade',
    },
]

// ── Talleres muestra ──────────────────────────────────────────
const TALLERES = [
    { nombre: 'Auriculoterapia Nivel 1', categoria: 'Horizonte Zen', color: '#0D7377' },
    { nombre: 'Automaquillaje Artístico', categoria: 'Bienestar', color: '#D97706' },
    { nombre: 'Iridología Básica', categoria: 'Horizonte Zen', color: '#0D7377' },
    { nombre: 'Elaboración de Gomitas', categoria: 'Habilidades', color: '#8B5CF6' },
    { nombre: 'Kinestep', categoria: 'Horizonte Zen', color: '#0D7377' },
    { nombre: 'Dibujo desde Cero', categoria: 'Arte', color: '#EC4899' },
]

// ── Subcomponentes ────────────────────────────────────────────
function StatItem({ value, label, Icon }) {
    return (
        <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 6, flex: 1, minWidth: 120,
        }}>
            <Icon size={22} color="var(--color-jade-500)" weight="fill" />
            <span style={{ fontSize: 'var(--text-3xl)', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
        {value}
      </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
        {label}
      </span>
        </div>
    )
}

function PilarCard({ Icon, titulo, texto, acento }) {
    const color = acento === 'amber' ? 'var(--color-amber-600)' : 'var(--color-jade-500)'
    const bg    = acento === 'amber' ? 'rgba(217,119,6,0.1)' : 'rgba(13,115,119,0.1)'
    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-2xl)',
            padding: 'var(--space-6)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
            flex: 1, minWidth: 240,
        }}>
            <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                <Icon size={24} color={color} weight="fill" />
            </div>
            <h3 style={{ margin: 0, fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {titulo}
            </h3>
            <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                {texto}
            </p>
        </div>
    )
}

function TallerChip({ nombre, categoria, color }) {
    return (
        <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-4) var(--space-5)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            cursor: 'default',
        }}>
            <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: `0 0 8px ${color}88`,
            }} />
            <div>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {nombre}
                </div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {categoria}
                </div>
            </div>
        </div>
    )
}

// ── Página ────────────────────────────────────────────────────
export default function PageLanding() {
    const navigate  = useNavigate()
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const logo = prefersDark ? logoDark : logoLight

    const [waHovered,  setWaHovered]  = useState(false)
    const [codeHovered, setCodeHovered] = useState(false)

    const irWhatsApp = () => {
        window.open(
            `https://wa.me/${WA_NUMBER}?text=Hola! quiero mi Chispa de acceso a Destello 🌟`,
            '_blank'
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-dark)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-sans)',
            overflowX: 'hidden',
        }}>

            {/* ══ HERO ══════════════════════════════════════════════ */}
            <section style={{
                minHeight: '100vh',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                textAlign: 'center',
                position: 'relative', overflow: 'hidden',
            }}>

                {/* Glows */}
                <div style={{
                    position: 'absolute', top: '20%', left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 700, height: 700, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(13,115,119,0.12) 0%, transparent 65%)',
                    pointerEvents: 'none',
                }} />
                <div style={{
                    position: 'absolute', bottom: '10%', right: '10%',
                    width: 350, height: 350, borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(217,119,6,0.07) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }} />

                {/* Contenido hero */}
                <div style={{ position: 'relative', zIndex: 1, maxWidth: 640 }}>
                    <img
                        src={logo} alt="Destello"
                        style={{
                            width: 72, height: 72, objectFit: 'contain',
                            display: 'block', margin: '0 auto var(--space-5)',
                            filter: 'drop-shadow(0 0 20px rgba(13,115,119,0.5))',
                        }}
                    />

                    <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 14px',
                        background: 'rgba(13,115,119,0.12)',
                        border: '1px solid rgba(13,115,119,0.3)',
                        borderRadius: 'var(--radius-full)',
                        fontSize: 'var(--text-xs)', fontWeight: 600,
                        color: 'var(--color-jade-500)',
                        marginBottom: 'var(--space-5)',
                    }}>
                        <Sparkle size={12} weight="fill" />
                        Plataforma de aprendizaje inmersivo 3D
                    </div>

                    <h1 style={{
                        fontSize: 'clamp(2.2rem, 6vw, 3.8rem)',
                        fontWeight: 700, lineHeight: 1.15,
                        letterSpacing: '-0.03em',
                        margin: '0 0 var(--space-5)',
                    }}>
                        Aprende con experiencias
                        <br />
                        <span style={{ color: 'var(--color-amber-600)' }}>que no olvidarás</span>
                    </h1>

                    <p style={{
                        fontSize: 'var(--text-lg)', color: 'var(--text-muted)',
                        lineHeight: 1.7, margin: '0 0 var(--space-8)',
                        maxWidth: 520, marginInline: 'auto',
                    }}>
                        Destello es la primera plataforma donde tomas talleres dentro de
                        aulas 3D en vivo, con maestros reales, gamificación y una comunidad
                        que aprende contigo.
                    </p>

                    {/* CTAs */}
                    <div style={{
                        display: 'flex', flexWrap: 'wrap',
                        gap: 'var(--space-3)', justifyContent: 'center',
                    }}>

                        {/* CTA principal — WhatsApp */}
                        <button
                            onClick={irWhatsApp}
                            onMouseEnter={() => setWaHovered(true)}
                            onMouseLeave={() => setWaHovered(false)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: 'var(--space-4) var(--space-6)',
                                background: waHovered ? '#1aab59' : '#25D366',
                                border: 'none', borderRadius: 'var(--radius-full)',
                                color: '#fff', fontFamily: 'var(--font-sans)',
                                fontWeight: 700, fontSize: 'var(--text-base)',
                                cursor: 'pointer',
                                transform: waHovered ? 'translateY(-2px)' : 'translateY(0)',
                                boxShadow: waHovered ? '0 8px 24px rgba(37,211,102,0.35)' : '0 4px 12px rgba(37,211,102,0.2)',
                                transition: 'all 0.18s ease',
                            }}
                        >
                            <WhatsappLogo size={20} weight="fill" />
                            Quiero mi Chispa
                        </button>

                        {/* CTA secundario — código */}
                        <button
                            onClick={() => navigate('/acceso')}
                            onMouseEnter={() => setCodeHovered(true)}
                            onMouseLeave={() => setCodeHovered(false)}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: 'var(--space-4) var(--space-6)',
                                background: 'transparent',
                                border: `1px solid ${codeHovered ? 'var(--color-jade-500)' : 'var(--border-default)'}`,
                                borderRadius: 'var(--radius-full)',
                                color: codeHovered ? 'var(--color-jade-500)' : 'var(--text-primary)',
                                fontFamily: 'var(--font-sans)',
                                fontWeight: 600, fontSize: 'var(--text-base)',
                                cursor: 'pointer',
                                transform: codeHovered ? 'translateY(-2px)' : 'translateY(0)',
                                transition: 'all 0.18s ease',
                            }}
                        >
                            Ya tengo mi Chispa
                            <ArrowRight size={18} />
                        </button>

                    </div>
                </div>
            </section>

            {/* ══ STATS ════════════════════════════════════════════ */}
            <section style={{
                padding: 'var(--space-10) var(--space-6)',
                borderTop: '1px solid var(--border-subtle)',
                borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
            }}>
                <div style={{
                    maxWidth: 860, marginInline: 'auto',
                    display: 'flex', flexWrap: 'wrap',
                    gap: 'var(--space-8)', justifyContent: 'center',
                }}>
                    {STATS.map(s => <StatItem key={s.label} {...s} />)}
                </div>
            </section>

            {/* ══ QUIÉNES SOMOS ════════════════════════════════════ */}
            <section style={{
                maxWidth: 720, marginInline: 'auto',
                padding: 'var(--space-20) var(--space-6)',
                textAlign: 'center',
            }}>
        <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 700,
            color: 'var(--color-jade-500)', letterSpacing: '0.1em',
            textTransform: 'uppercase',
        }}>
          Quiénes somos
        </span>
                <h2 style={{
                    fontSize: 'clamp(1.6rem, 4vw, 2.5rem)',
                    fontWeight: 700, letterSpacing: '-0.02em',
                    margin: 'var(--space-3) 0 var(--space-5)',
                }}>
                    Nacimos para cambiar cómo se aprende
                </h2>
                <p style={{
                    fontSize: 'var(--text-lg)', color: 'var(--text-muted)',
                    lineHeight: 1.75, margin: 0,
                }}>
                    Destello nació de una idea simple: el aprendizaje más poderoso
                    ocurre cuando te emocionas. Conectamos a maestros expertos con
                    alumnos de todo el mundo dentro de aulas 3D en vivo donde cada
                    clase es una experiencia que quieres repetir.
                </p>
            </section>

            {/* ══ METODOLOGÍA ══════════════════════════════════════ */}
            <section style={{
                padding: 'var(--space-10) var(--space-6) var(--space-20)',
            }}>
                <div style={{ maxWidth: 960, marginInline: 'auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
            <span style={{
                fontSize: 'var(--text-xs)', fontWeight: 700,
                color: 'var(--color-amber-600)', letterSpacing: '0.1em',
                textTransform: 'uppercase',
            }}>
              Nuestra metodología
            </span>
                        <h2 style={{
                            fontSize: 'clamp(1.6rem, 4vw, 2.5rem)',
                            fontWeight: 700, letterSpacing: '-0.02em',
                            margin: 'var(--space-3) 0 0',
                        }}>
                            Tres pilares que nos hacen únicos
                        </h2>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                        {PILARES.map(p => <PilarCard key={p.titulo} {...p} />)}
                    </div>
                </div>
            </section>

            {/* ══ TALLERES ═════════════════════════════════════════ */}
            <section style={{
                padding: 'var(--space-10) var(--space-6) var(--space-20)',
                borderTop: '1px solid var(--border-subtle)',
            }}>
                <div style={{ maxWidth: 960, marginInline: 'auto' }}>
                    <div style={{
                        display: 'flex', flexWrap: 'wrap',
                        justifyContent: 'space-between', alignItems: 'flex-end',
                        gap: 'var(--space-4)', marginBottom: 'var(--space-8)',
                    }}>
                        <div>
              <span style={{
                  fontSize: 'var(--text-xs)', fontWeight: 700,
                  color: 'var(--color-jade-500)', letterSpacing: '0.1em',
                  textTransform: 'uppercase',
              }}>
                Talleres
              </span>
                            <h2 style={{
                                fontSize: 'clamp(1.4rem, 3vw, 2rem)',
                                fontWeight: 700, margin: 'var(--space-2) 0 0',
                            }}>
                                Una muestra de lo que te espera
                            </h2>
                        </div>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              y muchos más por venir...
            </span>
                    </div>

                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                        gap: 'var(--space-3)',
                    }}>
                        {TALLERES.map(t => <TallerChip key={t.nombre} {...t} />)}
                    </div>
                </div>
            </section>

            {/* ══ CTA FINAL ════════════════════════════════════════ */}
            <section style={{
                padding: 'var(--space-20) 0',
                textAlign: 'center',
                borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
            }}>
                <div style={{ maxWidth: 540, marginInline: 'auto' }}>
                    <h2 style={{
                        fontSize: 'clamp(1.6rem, 4vw, 2.5rem)',
                        fontWeight: 700, letterSpacing: '-0.02em',
                        margin: '0 0 var(--space-3)',
                    }}>
                        ¿Listo para tu primer destello?
                    </h2>
                    <p style={{
                        fontSize: 'var(--text-base)', color: 'var(--text-muted)',
                        margin: '0 0 var(--space-8)', lineHeight: 1.6,
                    }}>
                        Consigue tu Chispa de acceso por WhatsApp y únete a la lista
                        de los primeros alumnos con un{' '}
                        <span style={{ color: 'var(--color-amber-600)', fontWeight: 600 }}>
              regalo exclusivo
            </span>
                        {' '}en tu primer taller.
                    </p>
                    <div style={{
                        display: 'flex', flexWrap: 'wrap',
                        gap: 'var(--space-3)', justifyContent: 'center',
                    }}>
                        <button
                            onClick={irWhatsApp}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: 'var(--space-4) var(--space-6)',
                                background: '#25D366', border: 'none',
                                borderRadius: 'var(--radius-full)',
                                color: '#fff', fontFamily: 'var(--font-sans)',
                                fontWeight: 700, fontSize: 'var(--text-base)', cursor: 'pointer',
                                transition: 'all 0.18s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#1aab59'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#25D366'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                            <WhatsappLogo size={20} weight="fill" />
                            Quiero mi Chispa
                        </button>
                        <button
                            onClick={() => navigate('/acceso')}
                            style={{
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                padding: 'var(--space-4) var(--space-6)',
                                background: 'var(--color-jade-500)', border: 'none',
                                borderRadius: 'var(--radius-full)',
                                color: '#FAF7F2', fontFamily: 'var(--font-sans)',
                                fontWeight: 600, fontSize: 'var(--text-base)', cursor: 'pointer',
                                transition: 'all 0.18s ease',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#0a8a8f'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--color-jade-500)'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                            Ya tengo mi Chispa
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer mínimo */}
            <footer style={{
                padding: 'var(--space-6)',
                textAlign: 'center',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-disabled)',
                borderTop: '1px solid var(--border-subtle)',
            }}>
                © 2026 Destello · Todos los derechos reservados
            </footer>

        </div>
    )
}