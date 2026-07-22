/**
 * Destello — PageHome
 * Home principal después del login. Es el centro de vida del alumno:
 *   · Energía / gamificación (Destellos, Logros, Racha)
 *   · Ruta de progreso
 *   · Mis talleres → botón a Material de apoyo + modelos 3D (vigencia 30 días)
 *   · Canjear Chispa (desbloquea taller nuevo)
 *   · Tienda de Destellos (moneda general)
 *   · Promos exclusivas alumnos + Próximos cursos
 *   · Constelación de amigos (referidos): Estrellas → Supernovas
 *
 * ── Sistema de puntos (definición de negocio) ──────────────────────────
 *   Destellos    → moneda general de la plataforma (se gasta en la Tienda).
 *   Estrellas    → puntos que SOLO se ganan por referidos (código de amigo).
 *   Supernovas   → catálogo de premios grandes que se canjean con Estrellas.
 *   Polvo estelar→ concepto/nombre del acto de compartir tu código de amigo.
 *
 * ⚠️ Los datos son mock por ahora. Cuando exista el backend de referidos y
 *    progreso, reemplazar HOME_MOCK por la respuesta de la API.
 * ──────────────────────────────────────────────────────────────────────
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@store/useAuthStore.js'
import {
  Sparkle,
  Trophy,
  Fire,
  Cube,
  Clock,
  VideoCamera,
  Gift,
  Star,
  ShootingStar,
  CalendarBlank,
  Tag,
  ArrowRight,
  Medal,
  CheckCircle,
  UsersThree,
} from '@phosphor-icons/react'

/* ============================================================
   Datos mock — reemplazar por API cuando exista el backend
   ============================================================ */
const HOME_MOCK = {
  nombre: 'Paola',
  // Moneda general
  destellos: 120,
  logros: 12,
  racha: 7,
  // Referidos
  codigoAmigo: 'PAO-BRILLA',
  estrellas: 3,          // estrellas ganadas
  estrellasMeta: 5,      // estrellas para el próximo premio
  premioProximo: '1 mes gratis',
  // Ruta de progreso (hitos)
  progresoHitos: [
    { label: 'Día 1',  estado: 'done',    Icon: CheckCircle },
    { label: 'Día 2',  estado: 'current', Icon: Medal },
    { label: 'Día 7',  estado: 'locked',  Icon: Medal },
    { label: 'Día 15', estado: 'locked',  Icon: Trophy },
  ],
  progresoPct: 40, // % de la barra de la ruta
  talleres: [
    {
      id: '1',
      nombre: 'Auriculoterapia Nivel 1',
      categoria: 'Horizonte Zen',
      color: '#0D7377',
      Icon: Sparkle,
      // Fecha en que se impartió el taller; el material vive 30 días después.
      impartido: '2026-07-02',
    },
    {
      id: '2',
      nombre: 'Automaquillaje Artístico',
      categoria: 'Estilo Personal',
      color: '#D97706',
      Icon: Tag,
      impartido: '2026-07-09',
    },
  ],
  // Tienda de Destellos (moneda general)
  tienda: [
    { titulo: 'Mes de acceso gratis',   costo: 500, Icon: CalendarBlank, moneda: 'destellos' },
    { titulo: 'Masterclass exclusiva',  costo: 300, Icon: Star,          moneda: 'destellos' },
    { titulo: 'Taller a elegir',        costo: 800, Icon: Gift,          moneda: 'destellos' },
  ],
  promos: [
    { titulo: '2x1 en tu segundo taller Zen', detalle: 'Exclusivo alumnos · termina en 6 días' },
  ],
  proximos: [
    { nombre: 'Iridología', fecha: '1 ago' },
    { nombre: 'Gomitas artesanales', fecha: '8 ago' },
    { nombre: 'Dibujo expresivo', fecha: '15 ago' },
  ],
}

/* Estilo por categoría (color + ícono del thumbnail). */
function estiloCategoria(categoria = '') {
  const zen = /zen|horizonte/i.test(categoria)
  return { color: zen ? '#0D7377' : '#D97706', Icon: zen ? Sparkle : Tag }
}

/* Fecha corta "10 ago" (interpretada al mediodía para evitar corrimientos). */
function fmtFechaCorta(iso) {
  if (!iso) return null
  const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`)
  if (isNaN(d)) return null
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
}

/* ============================================================
   Estilos + responsive (media queries reales vía <style>).
   Los pseudo-selectores y breakpoints no se pueden expresar
   con estilos inline, por eso van aquí — igual que la Navbar.
   ============================================================ */
const HOME_CSS = `
.dh-wrap {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--space-8);
  box-sizing: border-box;
}
.dh-section-title {
  font-size: var(--text-sm);
  font-weight: 700;
  color: var(--color-jade-400);
  letter-spacing: 0.02em;
  margin: 0 0 var(--space-3);
}
.dh-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
}

/* ── Header ── */
.dh-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-4);
  flex-wrap: wrap;
  margin-bottom: var(--space-6);
}
.dh-hello { font-size: var(--text-3xl); font-weight: 700; letter-spacing: -0.02em; margin: 0; }
.dh-sub { color: var(--text-muted); font-size: var(--text-sm); margin: 4px 0 0; }

/* ── Píldoras de energía ── */
.dh-energy { display: flex; gap: var(--space-3); }
.dh-pill {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: var(--space-2) var(--space-4);
  text-align: center;
  min-width: 74px;
}
.dh-pill-val { font-size: var(--text-lg); font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 5px; }
.dh-pill-lbl { font-size: var(--text-xs); color: var(--text-muted); }

/* ── Ruta de progreso ── */
.dh-ruta { padding: var(--space-5); margin-bottom: var(--space-6); }
.dh-ruta-track { position: relative; display: flex; align-items: flex-start; justify-content: space-between; }
.dh-ruta-line { position: absolute; left: 6%; right: 6%; top: 16px; height: 3px; background: var(--border-default); border-radius: var(--radius-full); }
.dh-ruta-fill { position: absolute; left: 6%; top: 16px; height: 3px; background: linear-gradient(90deg, var(--color-jade-500), var(--color-amber-600)); border-radius: var(--radius-full); }
.dh-hito { position: relative; text-align: center; z-index: 1; flex: 1; }
.dh-hito-dot { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
.dh-hito-lbl { font-size: var(--text-xs); color: var(--text-muted); margin-top: 6px; }

/* ── Grids ── */
.dh-grid-talleres { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
.dh-grid-tienda   { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); margin-bottom: var(--space-6); }
.dh-grid-promos   { display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--space-4); margin-bottom: var(--space-6); }

/* ── Estado vacío / cargando de talleres ── */
.dh-empty {
  grid-column: 1 / -1;
  padding: var(--space-6);
  text-align: center;
  color: var(--text-muted);
  font-size: var(--text-sm);
  background: var(--bg-card);
  border: 1px dashed var(--border-default);
  border-radius: var(--radius-xl);
}

/* ── Card de taller ── */
.dh-taller { overflow: hidden; display: flex; flex-direction: column; }
.dh-taller-thumb { height: 84px; position: relative; display: flex; align-items: center; justify-content: center; }
.dh-taller-badge {
  position: absolute; top: 8px; right: 8px;
  background: rgba(217,119,6,0.92); color: #fff;
  font-size: var(--text-xs); font-weight: 700;
  padding: 3px 9px; border-radius: var(--radius-full);
  display: flex; align-items: center; gap: 4px;
}
.dh-taller-body { padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
.dh-taller-cat { font-size: var(--text-xs); color: var(--color-amber-600); font-weight: 700; }
.dh-taller-name { font-size: var(--text-sm); font-weight: 600; margin: 0; }

/* ── Botones ── */
.dh-btn {
  font-family: var(--font-sans);
  border-radius: var(--radius-lg);
  cursor: pointer;
  font-weight: 600;
  transition: filter 0.15s ease, transform 0.1s ease, background 0.15s ease;
  display: inline-flex; align-items: center; justify-content: center; gap: 6px;
}
.dh-btn:active { transform: scale(0.98); }
.dh-btn--material {
  width: 100%;
  background: rgba(13,115,119,0.22);
  border: 1px solid var(--color-jade-500);
  color: var(--color-jade-300);
  font-size: var(--text-xs);
  padding: var(--space-2) var(--space-3);
}
.dh-btn--material:hover { background: rgba(13,115,119,0.34); }
.dh-btn--material:disabled { opacity: 0.55; cursor: not-allowed; border-color: var(--border-default); color: var(--text-muted); background: transparent; }
.dh-btn--amber {
  background: var(--color-amber-600); color: #fff; border: none;
  font-size: var(--text-sm); padding: var(--space-3) var(--space-5);
}
.dh-btn--amber:hover { filter: brightness(1.08); }
.dh-btn--ghost-amber {
  background: rgba(217,119,6,0.14); border: 1px solid var(--color-amber-600);
  color: var(--color-amber-500); font-size: var(--text-xs);
  padding: var(--space-2) var(--space-3);
}

/* ── Canjear chispa ── */
.dh-chispa {
  display: flex; align-items: center; justify-content: space-between; gap: var(--space-4);
  flex-wrap: wrap;
  background: linear-gradient(120deg, rgba(217,119,6,0.16), rgba(13,115,119,0.12));
  border: 1px solid rgba(217,119,6,0.4);
  border-radius: var(--radius-xl);
  padding: var(--space-4) var(--space-5);
  margin-bottom: var(--space-6);
  box-shadow: var(--shadow-md);
}
.dh-chispa-left { display: flex; align-items: center; gap: var(--space-4); }
.dh-chispa-orb {
  width: 46px; height: 46px; flex-shrink: 0;
  background: radial-gradient(circle, var(--color-amber-500), var(--color-amber-800));
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow-amber);
}
.dh-chispa--tappable { cursor: pointer; transition: filter 0.15s ease, transform 0.1s ease; }
.dh-chispa--tappable:hover { filter: brightness(1.05); }
.dh-chispa--tappable:active { transform: scale(0.995); }

/* ── Card interactiva de canje de chispa ── */
.dh-canje { display: block; margin-bottom: var(--space-6); animation: fadeIn 0.28s ease; }
.dh-canje-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-3); }
.dh-canje-title { display: flex; align-items: center; gap: 8px; font-size: var(--text-base); font-weight: 700; }
.dh-canje-close {
  background: none; border: none; color: var(--text-muted);
  display: inline-flex; padding: 4px; border-radius: var(--radius-md);
}
.dh-canje-close:hover { color: var(--text-primary); background: var(--bg-surface); }
.dh-canje-form { display: flex; gap: var(--space-2); flex-wrap: wrap; }
.dh-input {
  flex: 1; min-width: 160px;
  background: var(--bg-surface);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-3) var(--space-4);
  color: var(--text-primary);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.dh-input:focus { outline: 2px solid var(--color-jade-500); outline-offset: 1px; border-color: transparent; }
.dh-canje-error {
  display: flex; align-items: center; gap: 6px;
  margin-top: var(--space-3);
  font-size: var(--text-xs); color: var(--color-error);
}
.dh-canje-result {
  margin-top: var(--space-4);
  padding: var(--space-4);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: rgba(13,115,119,0.10);
  animation: fadeIn 0.28s ease;
}
.dh-result-row { display: flex; align-items: center; gap: 8px; font-size: var(--text-sm); margin-bottom: var(--space-2); }
.dh-result-name { font-size: var(--text-lg); font-weight: 700; margin: 0 0 var(--space-1); }
.dh-spin { display: inline-flex; animation: dh-rotate 0.8s linear infinite; }
@keyframes dh-rotate { to { transform: rotate(360deg); } }

/* ── Tienda ── */
.dh-tienda-item { padding: var(--space-4); text-align: center; display: flex; flex-direction: column; align-items: center; gap: var(--space-2); }
.dh-cost { font-size: var(--text-xs); font-weight: 700; color: var(--color-amber-500); display: inline-flex; align-items: center; gap: 4px; }

/* ── Promos / próximos ── */
.dh-block { padding: var(--space-4) var(--space-5); }
.dh-block-tag { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); font-weight: 700; margin-bottom: var(--space-3); }
.dh-next-row { font-size: var(--text-sm); font-weight: 500; margin: 0 0 var(--space-2); }
.dh-next-row span { color: var(--text-muted); font-weight: 400; }

/* ── Constelación de amigos (referidos) ── */
.dh-refer {
  background: linear-gradient(120deg, var(--bg-card), var(--bg-surface));
  border: 1px solid var(--border-default);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  box-shadow: var(--shadow-md);
}
.dh-refer-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-3); flex-wrap: wrap; margin-bottom: var(--space-3); }
.dh-refer-title { display: flex; align-items: center; gap: 8px; font-size: var(--text-base); font-weight: 700; }
.dh-code {
  font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700;
  color: var(--color-amber-500);
  background: rgba(217,119,6,0.14); border: 1px dashed var(--color-amber-600);
  padding: 5px 12px; border-radius: var(--radius-md);
}
.dh-stars { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }

/* ═══════════════ RESPONSIVE ═══════════════ */
@media (max-width: 768px) {
  .dh-wrap { padding: var(--space-5) var(--space-4); }
  .dh-hello { font-size: var(--text-2xl); }
  .dh-header { flex-direction: column; align-items: stretch; }
  .dh-energy { width: 100%; }
  .dh-pill { flex: 1; min-width: 0; }
  .dh-grid-tienda { grid-template-columns: 1fr; }
  .dh-grid-promos { grid-template-columns: 1fr; }
  .dh-chispa { flex-direction: column; align-items: stretch; }
  .dh-chispa .dh-btn--amber { width: 100%; }
}
@media (max-width: 460px) {
  .dh-wrap { padding: var(--space-4) var(--space-3); }
  .dh-grid-talleres { grid-template-columns: 1fr; }
  .dh-hito-lbl { font-size: 0.68rem; }
}
`

/* ── Subcomponente: card de taller desbloqueado (datos reales de la API) ── */
function TallerCard({ taller, onMaterial, onClase }) {
  const { color, Icon } = estiloCategoria(taller.categoria)
  const mat = taller.material || {}

  // Texto del badge según el estado más relevante.
  let badge = 'Concluido'
  if (taller.claseAccesibleHoy)          badge = 'En vivo hoy'
  else if (taller.fase === 'proximo')    badge = fmtFechaCorta(taller.fechaInicio) || 'Próximo'
  else if (mat.disponible)               badge = `Material · ${mat.diasRestantes}d`
  else if (mat.estado === 'expirado')    badge = 'Finalizado'

  const materialTexto = mat.disponible
    ? `Material y modelos 3D · ${mat.diasRestantes} días`
    : mat.estado === 'expirado'
      ? 'Material no disponible'
      : 'Material al concluir'

  return (
    <div className="dh-card dh-taller">
      <div
        className="dh-taller-thumb"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}88)` }}
      >
        <Icon size={30} color="rgba(255,255,255,0.9)" weight="fill" />
        <span className="dh-taller-badge">
          <Clock size={12} weight="bold" />{badge}
        </span>
      </div>
      <div className="dh-taller-body">
        <span className="dh-taller-cat">{taller.categoria}</span>
        <h3 className="dh-taller-name">{taller.nombre}</h3>

        {taller.claseAccesibleHoy && (
          <button
            className="dh-btn dh-btn--amber"
            style={{ width: '100%' }}
            onClick={() => onClase(taller.tallerId)}
          >
            <VideoCamera size={14} weight="fill" /> Entrar a clase
          </button>
        )}

        <button
          className="dh-btn dh-btn--material"
          disabled={!mat.disponible}
          onClick={() => onMaterial(taller.tallerId)}
          title={mat.disponible ? 'Material de apoyo y modelos 3D' : 'Se libera al concluir el taller'}
        >
          <Cube size={14} weight="fill" />{materialTexto}
        </button>
      </div>
    </div>
  )
}

/* ── Página ── */
export default function PageHome() {
  const navigate = useNavigate()
  const data = HOME_MOCK

  // ── Datos reales del usuario (BD: estrellas + código de referido) ──
  const token = useAuthStore((s) => s.token)
  const [nombre, setNombre]               = useState(null) // nombre real (BD)
  const [estrellas, setEstrellas]         = useState(null) // null = cargando
  const [racha, setRacha]                 = useState(null)
  const [logros, setLogros]               = useState(null)
  const [codigoReferido, setCodigoReferido] = useState(null)
  const [supernovas, setSupernovas]       = useState([])
  const [proximos, setProximos]           = useState([])

  useEffect(() => {
    if (!token) return
    fetch('/api/users/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (res?.user) {
          if (res.user.nombre) setNombre(res.user.nombre)
          if (typeof res.user.estrellas === 'number') setEstrellas(res.user.estrellas)
          if (typeof res.user.racha === 'number')     setRacha(res.user.racha)
          if (typeof res.user.logros === 'number')    setLogros(res.user.logros)
          if (res.user.codigo_referido) setCodigoReferido(res.user.codigo_referido)
        }
      })
      .catch(() => { /* si falla, dejamos el valor por defecto */ })
  }, [token])

  // Catálogo de Supernovas (público)
  useEffect(() => {
    fetch('/api/supernovas')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setSupernovas(res?.supernovas || []))
      .catch(() => {})
  }, [])

  // Talleres próximos (público) para "Próximos cursos"
  useEffect(() => {
    fetch('/api/tallers')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setProximos(res?.tallers || res?.talleres || []))
      .catch(() => {})
  }, [])

  const estrellasVal = estrellas ?? 0 // valores reales de la BD (0 mientras cargan)
  const rachaVal     = racha ?? 0
  const logrosVal    = logros ?? 0
  const nombreVal    = nombre ?? data.nombre // nombre real de la BD (o mock mientras carga)
  const codigoAmigo  = codigoReferido ?? data.codigoAmigo
  const costoMin     = supernovas.length ? Math.min(...supernovas.map((s) => s.costo_estrellas)) : null
  const puedeCanjear = costoMin != null && estrellasVal >= costoMin

  // Ruta de progreso = racha de constancia (Día 1 → 30).
  const HITOS_RACHA = [1, 7, 15, 30]
  const rutaIconos  = [CheckCircle, Medal, Medal, Trophy]
  const rutaHitos = HITOS_RACHA.map((dia, i) => {
    const done     = rachaVal >= dia
    const prevDone = i === 0 ? true : rachaVal >= HITOS_RACHA[i - 1]
    return {
      label:  `Día ${dia}`,
      estado: done ? 'done' : (prevDone ? 'current' : 'locked'),
      Icon:   rutaIconos[i],
    }
  })
  const rutaPct = Math.min(100, Math.round((rachaVal / 30) * 100))

  // ── Mis talleres desbloqueados (BD: chispas canjeadas + estado) ──
  const [misTalleres, setMisTalleres]         = useState([])
  const [loadingTalleres, setLoadingTalleres] = useState(true)

  const cargarTalleres = () => {
    if (!token) { setLoadingTalleres(false); return }
    fetch('/api/users/me/talleres', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => setMisTalleres(res?.talleres || []))
      .catch(() => { /* silencioso */ })
      .finally(() => setLoadingTalleres(false))
  }
  useEffect(() => { cargarTalleres() }, [token]) // eslint-disable-line react-hooks/exhaustive-deps

  // Próximos cursos = talleres 'proximamente' que aún no tomas, por fecha.
  // (Se calcula aquí, después de declarar misTalleres, para evitar usarlo antes.)
  const misIds = new Set(misTalleres.map((t) => t.tallerId))
  const proximosCursos = proximos
    .filter((t) => t.estado === 'proximamente' && !misIds.has(t.id))
    .sort((a, b) => String(a.fecha_inicio ?? '').localeCompare(String(b.fecha_inicio ?? '')))
    .slice(0, 4)

  const abrirMaterial = (tallerId) => {
    // El material de apoyo y los modelos 3D viven en el aula del taller.
    navigate(`/aula/${tallerId}`)
  }

  const entrarClase = (tallerId) => {
    // El botón solo aparece si claseAccesibleHoy === true (validado en backend).
    navigate(`/aula/${tallerId}`)
  }

  const dotStyle = (estado) => {
    if (estado === 'done') {
      return { background: 'var(--color-amber-600)', boxShadow: 'var(--shadow-amber)' }
    }
    if (estado === 'current') {
      return { background: 'var(--color-jade-500)' }
    }
    return { background: 'var(--bg-card)', border: '2px solid var(--border-default)' }
  }
  const dotIconColor = (estado) => (estado === 'locked' ? 'var(--text-disabled)' : '#fff')

  return (
    <>
      <style>{HOME_CSS}</style>

      <div className="dh-wrap">

        {/* ── Header + energía ── */}
        <div className="dh-header">
          <div>
            <h1 className="dh-hello">
              ¡Hola, {nombreVal}! <span style={{ color: 'var(--color-amber-600)' }}>✦</span>
            </h1>
            <p className="dh-sub">Tu viaje creativo continúa</p>
          </div>
          <div className="dh-energy">
            <div className="dh-pill">
              <div className="dh-pill-val" style={{ color: 'var(--color-amber-500)' }}>
                <Star size={16} weight="fill" />{estrellasVal}
              </div>
              <div className="dh-pill-lbl">Estrellas</div>
            </div>
            <div className="dh-pill">
              <div className="dh-pill-val"><Trophy size={16} weight="fill" color="var(--color-amber-600)" />{logrosVal}</div>
              <div className="dh-pill-lbl">Logros</div>
            </div>
            <div className="dh-pill">
              <div className="dh-pill-val"><Fire size={16} weight="fill" color="var(--color-amber-500)" />{rachaVal}</div>
              <div className="dh-pill-lbl">Racha</div>
            </div>
          </div>
        </div>

        {/* ── Ruta de progreso (racha de constancia) ── */}
        <div className="dh-card dh-ruta">
          <p className="dh-section-title">Ruta de progreso · {rachaVal} {rachaVal === 1 ? 'día' : 'días'} de constancia</p>
          <div className="dh-ruta-track">
            <div className="dh-ruta-line" />
            <div className="dh-ruta-fill" style={{ width: `${(rutaPct * 0.88)}%` }} />
            {rutaHitos.map(({ label, estado, Icon }) => (
              <div className="dh-hito" key={label}>
                <div className="dh-hito-dot" style={dotStyle(estado)}>
                  <Icon size={16} weight="fill" color={dotIconColor(estado)} />
                </div>
                <div className="dh-hito-lbl" style={estado === 'current' ? { color: 'var(--text-primary)' } : undefined}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Mis talleres ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-3)' }}>
          <p className="dh-section-title" style={{ margin: 0 }}>Mis talleres</p>
          <button
            onClick={() => navigate('/habitat')}
            className="dh-btn"
            style={{ background: 'none', border: 'none', color: 'var(--color-jade-400)', fontSize: 'var(--text-sm)', padding: 0 }}
          >
            Ver todos <ArrowRight size={14} />
          </button>
        </div>
        <div className="dh-grid-talleres">
          {loadingTalleres ? (
            <div className="dh-empty">Cargando tus talleres…</div>
          ) : misTalleres.length === 0 ? (
            <div className="dh-empty">
              Aún no tienes talleres. En cuanto se confirme tu pago, tu taller aparecerá aquí listo para ti. <span style={{ color: 'var(--color-amber-500)' }}>✦</span>
            </div>
          ) : (
            misTalleres.map((t) => (
              <TallerCard key={t.code} taller={t} onMaterial={abrirMaterial} onClase={entrarClase} />
            ))
          )}
        </div>

        {/* ── Tienda de Supernovas (próximamente) ──
           La tienda aún no existe; por ahora se muestra como teaser temático
           para que el Home se vea completo. Cuando exista el catálogo real,
           reactivar el canje (ver canjearSupernova + POST /users/me/supernovas/:id/canjear). */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3)' }}>
          <p className="dh-section-title" style={{ margin: 0 }}>Tienda de Supernovas</p>
          <span style={{
            fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-amber-500)',
            background: 'rgba(217,119,6,0.14)', border: '1px dashed var(--color-amber-600)',
            padding: '2px 10px', borderRadius: 'var(--radius-full)',
          }}>
            Muy pronto
          </span>
        </div>
        <div className="dh-grid-tienda">
          {(supernovas.length
            ? supernovas
            : data.tienda.map((t, i) => ({ id: `m${i}`, nombre: t.titulo, costo_estrellas: t.costo }))
          ).slice(0, 3).map((s, i) => {
            const Icon = [CalendarBlank, Star, Gift][i % 3]
            return (
              <div className="dh-card dh-tienda-item" key={s.id ?? s.nombre} style={{ opacity: 0.9 }}>
                <Icon size={24} weight="fill" color="var(--color-jade-400)" />
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{s.nombre}</div>
                <span className="dh-cost"><Star size={12} weight="fill" /> {s.costo_estrellas} Estrellas</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ShootingStar size={13} weight="fill" color="var(--color-amber-500)" /> Muy pronto
                </span>
              </div>
            )
          })}
        </div>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-2)' }}>
          Junta Estrellas invitando amigos ✦ Pronto podrás canjearlas por Supernovas.
        </p>

        {/* ── Promos + próximos ── */}
        <div className="dh-grid-promos">
          <div className="dh-card dh-block" style={{ borderColor: 'rgba(217,119,6,0.35)' }}>
            <div className="dh-block-tag" style={{ color: 'var(--color-amber-500)' }}>
              <Tag size={14} weight="fill" /> Exclusivo alumnos
            </div>
            {data.promos.map((p) => (
              <div key={p.titulo}>
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500 }}>{p.titulo}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: '4px 0 var(--space-3)' }}>{p.detalle}</div>
                <button className="dh-btn dh-btn--ghost-amber">Aprovechar</button>
              </div>
            ))}
          </div>
          <div className="dh-card dh-block">
            <div className="dh-block-tag" style={{ color: 'var(--color-jade-400)' }}>
              <CalendarBlank size={14} weight="fill" /> Próximos cursos
            </div>
            {proximosCursos.length === 0 ? (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', margin: 0 }}>
                Pronto anunciaremos nuevos talleres ✦
              </p>
            ) : (
              proximosCursos.map((c) => (
                <p className="dh-next-row" key={c.id}>
                  {c.nombre} <span>· {fmtFechaCorta(c.fecha_inicio) ?? 'próximamente'}</span>
                </p>
              ))
            )}
          </div>
        </div>

        {/* ── Constelación de amigos (referidos) ── */}
        <div className="dh-refer">
          <div className="dh-refer-head">
            <div className="dh-refer-title">
              <UsersThree size={20} weight="fill" color="var(--color-amber-600)" />
              Constelación de amigos
            </div>
            <span className="dh-code">{codigoAmigo}</span>
          </div>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: '0 0 var(--space-3)' }}>
            Comparte tu polvo estelar. Cada amigo que se une con tu código te suma
            Estrellas; júntalas para canjear Supernovas como meses gratis o un taller.
          </p>

          {puedeCanjear ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(217,119,6,0.14)', border: '1px solid var(--color-amber-600)',
              borderRadius: 'var(--radius-lg)', padding: 'var(--space-3) var(--space-4)',
              color: 'var(--color-amber-500)', fontSize: 'var(--text-sm)', fontWeight: 600,
            }}>
              <ShootingStar size={18} weight="fill" />
              ¡Ya puedes canjear tu Supernova! Tienes {estrellasVal} Estrellas ✦
            </div>
          ) : costoMin != null ? (
            <>
              <div style={{ height: 8, background: 'var(--bg-surface)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round((estrellasVal / costoMin) * 100))}%`,
                  background: 'linear-gradient(90deg, var(--color-jade-500), var(--color-amber-600))',
                  borderRadius: 'var(--radius-full)',
                }} />
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 6 }}>
                <Star size={13} weight="fill" color="var(--color-amber-500)" />
                {estrellasVal} de {costoMin} Estrellas · te faltan {costoMin - estrellasVal} para tu primera Supernova
              </span>
            </>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              <Star size={16} weight="fill" color="var(--color-amber-500)" /> {estrellasVal} Estrellas
            </span>
          )}
        </div>

      </div>
    </>
  )
}
