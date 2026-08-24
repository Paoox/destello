/**
 * Destello — Verificación pública de un certificado
 *
 * Ruta: /certificado/:folio  ← es a donde apunta el QR impreso en el diploma.
 *
 * ── Para quién es esta pantalla ─────────────────────────────────────────────
 * NO es para el alumno: él ya tiene su certificado. Es para **quien lo recibe**
 * y quiere comprobar que es real: una escuela, un empleador, alguien que lo vio
 * en LinkedIn. Esa persona no tiene cuenta en Destello y no debería necesitar
 * una. Por eso la ruta va FUERA de `MainLayout`: sin barra lateral, sin sesión,
 * sin invitarla a registrarse antes de responderle lo único que vino a
 * preguntar.
 *
 * ── Qué NO muestra ──────────────────────────────────────────────────────────
 * El correo del alumno, nunca. La API pública tampoco lo devuelve. El folio lo
 * puede traer cualquiera a quien se lo hayan compartido, y compartir un
 * certificado no puede significar compartir los datos personales de quien lo
 * obtuvo.
 *
 * ── Los cuatro finales ──────────────────────────────────────────────────────
 *   ✓ válido      → sello verde, nombre, taller, instructor, horas, fecha
 *   ⊘ anulado     → se dice claramente, sin adornos: este papel ya no vale
 *   ? no existe   → mismo mensaje para "mal escrito" que para "inventado"
 *   ! error       → se aclara que NO significa que el certificado sea falso
 *
 * Un folio anulado NO se disfraza de "no encontrado": quien verifica tiene
 * derecho a saber que ese folio existió y fue retirado, no que se equivocó de
 * dirección. Y una falla de red tampoco se disfraza de "inválido": acusar a un
 * certificado real por un 502 le costaría un trabajo a alguien.
 *
 * ── Por qué los colores viven en un <style> y no inline ─────────────────────
 * Destello tiene modo claro automático (`prefers-color-scheme`). El verde de
 * "válido" que se lee perfecto sobre el fondo oscuro casi desaparece sobre el
 * fondo crema. Una media query necesita CSS de verdad, así que los cuatro
 * colores del veredicto son variables y los íconos heredan con `currentColor`.
 */

import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
    SealCheck, Prohibit, MagnifyingGlass, WarningCircle,
    User, GraduationCap, CalendarBlank, Clock, Hash,
} from '@phosphor-icons/react'

import { apiVerificarCertificado } from '@services/publicApi.js'
import logo from '../Images/destello-logo-512.png'

/** 2026-08-24 → "24 de agosto de 2026" */
function fmtFechaLarga(iso) {
    if (!iso) return '—'
    // Se parte la cadena a mano en vez de `new Date(iso)`: una fecha sin hora
    // se interpreta como UTC y en México (UTC-6) se corría un día hacia atrás.
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number)
    if (!a || !m || !d) return '—'
    const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                   'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return `${d} de ${MESES[m - 1]} de ${a}`
}

export default function PageCertificado() {
    const { folio } = useParams()

    const [estado, setEstado] = useState('cargando') // cargando | valido | anulado | noExiste | error
    const [cert,   setCert]   = useState(null)

    useEffect(() => {
        let vivo = true
        setEstado('cargando')
        setCert(null)

        apiVerificarCertificado(folio)
            .then(json => {
                if (!vivo) return
                if (json.valido === false) { setEstado('anulado'); return }
                setCert(json.certificado)
                setEstado('valido')
            })
            .catch(err => {
                if (!vivo) return
                // 404 es una respuesta legítima, no una falla: ese folio no existe.
                setEstado(err.status === 404 ? 'noExiste' : 'error')
            })

        return () => { vivo = false }
    }, [folio])

    return (
        <div className="cert-page" style={sPagina}>
            <style>{CSS_VERIFICACION}</style>

            <main style={sHoja}>

                {/* ── Membrete ─────────────────────────────────────────── */}
                <div style={sMembrete}>
                    <img src={logo} alt="Destello" width={38} height={38}
                         style={{ borderRadius: 8, display: 'block' }} />
                    <div>
                        <div style={sMarca}>Destello</div>
                        <div style={sMembreteSub}>Verificación de certificados</div>
                    </div>
                </div>

                {estado === 'cargando' && <Cargando folio={folio} />}

                {estado === 'valido' && <Valido cert={cert} />}

                {estado === 'anulado' && (
                    <Veredicto
                        icon={Prohibit} tono="malo"
                        titulo="Este certificado fue anulado"
                        texto={'El folio existe, pero Destello lo retiró. Un certificado anulado '
                             + 'ya no acredita nada.'}
                        folio={folio} />
                )}

                {estado === 'noExiste' && (
                    <Veredicto
                        icon={MagnifyingGlass} tono="neutro"
                        titulo="No encontramos ese folio"
                        texto={'Ningún certificado de Destello tiene este folio. Revisa que esté '
                             + 'escrito tal como aparece en el diploma: no lleva las letras I ni O, '
                             + 'ni los números 0 ni 1, justo para que no se confundan.'}
                        folio={folio} />
                )}

                {estado === 'error' && (
                    <Veredicto
                        icon={WarningCircle} tono="aviso"
                        titulo="No pudimos comprobarlo ahora"
                        texto={'Algo falló de nuestro lado al consultar el certificado. Esto NO '
                             + 'quiere decir que sea falso. Vuelve a intentarlo en un momento.'}
                        folio={folio}
                        accion={
                            <button onClick={() => window.location.reload()} style={sBtn}>
                                Reintentar
                            </button>
                        } />
                )}

                {/* ── Pie ──────────────────────────────────────────────── */}
                <p style={sPie}>
                    Se emiten por{' '}
                    <strong style={{ color: 'var(--text-secondary)' }}>asistencia comprobada</strong>{' '}
                    al taller en vivo. <Link to="/bienvenida" className="cert-enlace">Conoce Destello</Link>
                </p>
            </main>
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════════════════════
   Los estados
   ═══════════════════════════════════════════════════════════════════════════ */

function Cargando({ folio }) {
    return (
        <div style={{ textAlign: 'center', padding: '26px 0' }}>
            <div style={sSpinner} />
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', marginTop: 14 }}>
                Comprobando el folio
            </p>
            <p style={sFolioChip}>{String(folio ?? '').toUpperCase()}</p>
        </div>
    )
}

/** El caso bueno: sello arriba, la persona en grande, los datos abajo. */
function Valido({ cert }) {
    return (
        <>
            <div style={{ textAlign: 'center' }}>
                <div className="cert-sello cert-bueno" style={sSello}>
                    <SealCheck size={34} weight="fill" />
                </div>

                <h1 className="cert-titulo cert-bueno" style={sVeredictoTitulo}>
                    Certificado válido
                </h1>
                <p style={{ ...sVeredictoTexto, marginBottom: 16 }}>
                    Emitido por Destello y vigente.
                </p>
            </div>

            {/* La persona, en grande: es el dato que se vino a verificar. */}
            <div style={sProtagonista}>
                <div style={sEtiquetaChica}>Otorgado a</div>
                <div className="cert-nombre" style={sNombre}>{cert.nombre}</div>
            </div>

            <dl style={sDatos}>
                <Dato icon={GraduationCap} etiqueta="Taller" valor={cert.taller} />
                {cert.instructor && (
                    <Dato icon={User} etiqueta="Instructor" valor={cert.instructor} />
                )}
                {/* Fecha y duración comparten renglón: son dos datos cortos y
                    separarlos costaba una línea entera en celular, que es donde
                    la página tiene que caber sin scroll. */}
                <Dato icon={CalendarBlank} etiqueta="Impartido"
                      valor={`${fmtFechaLarga(cert.fecha)} · ${cert.duracionHoras ?? 4} horas`} />
                <Dato icon={Hash} etiqueta="Folio" valor={cert.folio} mono
                      pie={cert.emitido ? `emitido el ${fmtFechaLarga(cert.emitido)}` : null} />
            </dl>
        </>
    )
}

/** Los tres casos que no son "válido": mismo molde, distinto tono. */
function Veredicto({ icon: Icono, tono, titulo, texto, folio, accion }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div className={`cert-sello cert-${tono}`} style={sSello}>
                <Icono size={44} weight="fill" />
            </div>

            <h1 className={`cert-titulo cert-${tono}`} style={sVeredictoTitulo}>{titulo}</h1>
            <p style={sVeredictoTexto}>{texto}</p>

            <p style={sFolioChip}>{String(folio ?? '').toUpperCase()}</p>

            {accion && <div style={{ marginTop: 20 }}>{accion}</div>}
        </div>
    )
}

function Dato({ icon: Icono, etiqueta, valor, mono, pie }) {
    return (
        <div style={sFila}>
            <dt className="cert-etiqueta" style={sFilaEtiqueta}>
                <Icono size={13} weight="bold" style={{ flexShrink: 0 }} />
                <span>{etiqueta}</span>
            </dt>
            <dd style={sFilaValor}>
                <span style={{
                    fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : undefined,
                    letterSpacing: mono ? '.06em' : undefined,
                }}>
                    {valor || '—'}
                </span>
                {pie && <span style={sFilaPie}>{pie}</span>}
            </dd>
        </div>
    )
}


/* ═══════════════════════════════════════════════════════════════════════════
   CSS — solo lo que una media query o un pseudo-elemento no permiten inline
   ═══════════════════════════════════════════════════════════════════════════ */

const CSS_VERIFICACION = `
.cert-page {
    --v-bueno:  #22C58A;
    --v-malo:   #E66767;
    --v-aviso:  #E0A93B;
    --v-neutro: #8EC8C8;
    --v-nombre: var(--color-jade-200);
    --v-icono:  var(--color-jade-300);
}

/* En claro los mismos tonos casi desaparecen sobre el papel crema: se bajan. */
@media (prefers-color-scheme: light) {
    .cert-page {
        --v-bueno:  #0B7A54;
        --v-malo:   #B33A3A;
        --v-aviso:  #8A5D0C;
        --v-neutro: #0D7377;
        --v-nombre: var(--color-jade-700);
        --v-icono:  var(--color-jade-600);
    }
}

/* Los íconos de Phosphor heredan con currentColor: basta pintar el contenedor. */
.cert-bueno  { color: var(--v-bueno); }
.cert-malo   { color: var(--v-malo); }
.cert-aviso  { color: var(--v-aviso); }
.cert-neutro { color: var(--v-neutro); }

.cert-sello  { background: color-mix(in srgb, currentColor 12%, transparent);
               border: 1px solid color-mix(in srgb, currentColor 38%, transparent); }

/* ⚠️ El CSS global de Destello le pone degradado a los <h1>/<h2> y aquí el
   título saldría fantasma. Mismo tropiezo que ya se pisó en el diploma. */
.cert-titulo { background: none !important; -webkit-text-fill-color: currentColor; }

.cert-nombre   { color: var(--v-nombre); }
.cert-etiqueta > svg { color: var(--v-icono); }
.cert-enlace   { color: var(--v-icono); font-weight: 600; text-decoration: none; }
.cert-enlace:hover { text-decoration: underline; }

@keyframes cert-giro { to { transform: rotate(360deg); } }
`


/* ═══════════════════════════════════════════════════════════════════════════
   Estilos
   ═══════════════════════════════════════════════════════════════════════════ */

// La tarjeta se centra en la pantalla en vez de colgar de arriba: la página
// está hecha para caber de una sola vista, y con `flex-start` una pantalla alta
// dejaba todo el hueco abajo, como si faltara algo por cargar.
const sPagina = {
    minHeight: '100vh',
    background: 'var(--bg-dark)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 'clamp(10px, 3vw, 32px) 12px',
    boxSizing: 'border-box',
}

const sHoja = {
    width: '100%', maxWidth: 460,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-xl)',
    padding: 'clamp(16px, 4.5vw, 28px)',
    boxSizing: 'border-box',
    boxShadow: 'var(--shadow-md)',
}

const sMembrete = {
    display: 'flex', alignItems: 'center', gap: 10,
    paddingBottom: 12, marginBottom: 16,
    borderBottom: '1px solid var(--border-subtle)',
}

const sMarca = {
    fontSize: 'var(--text-base, 15px)', fontWeight: 700,
    color: 'var(--text-primary)', lineHeight: 1.15,
}

const sMembreteSub = {
    fontSize: 10, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 600,
}

const sSello = {
    width: 62, height: 62, margin: '0 auto 12px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: '50%', boxSizing: 'border-box',
}

const sVeredictoTitulo = {
    fontSize: 'clamp(19px, 4.4vw, 23px)', fontWeight: 700,
    margin: '0 0 6px', lineHeight: 1.25,
}

const sVeredictoTexto = {
    color: 'var(--text-muted)', fontSize: 'var(--text-xs, 12px)',
    lineHeight: 1.55, margin: '0 auto', maxWidth: 340,
}

const sProtagonista = {
    textAlign: 'center',
    padding: '13px 14px', marginBottom: 14,
    background: 'rgba(13,115,119,.10)',
    border: '1px solid rgba(142,200,200,.22)',
    borderRadius: 'var(--radius-lg)',
}

const sEtiquetaChica = {
    fontSize: 9, color: 'var(--text-muted)', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 5,
}

const sNombre = {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontStyle: 'italic',
    fontSize: 'clamp(21px, 5.4vw, 28px)',
    lineHeight: 1.2,
    wordBreak: 'break-word',
}

const sDatos = { margin: 0, display: 'flex', flexDirection: 'column' }

// ⚠️ Rejilla y NO flex con `wrap`: en celular la etiqueta se iba a su propia
// línea y cada dato costaba dos renglones. Con dos columnas fijas, etiqueta y
// valor siempre comparten renglón y la página cabe sin scroll.
const sFila = {
    display: 'grid',
    gridTemplateColumns: 'clamp(96px, 26%, 112px) 1fr',
    gap: 10, alignItems: 'baseline',
    padding: '8px 2px',
    borderTop: '1px solid var(--border-subtle)',
}

// ⚠️ El ancho mínimo (96px) lo manda la etiqueta más larga, INSTRUCTOR: con
// menos, el ícono se comprimía a cero y esa fila era la única sin ícono.
const sFilaEtiqueta = {
    display: 'flex', alignItems: 'center', gap: 6, minWidth: 0,
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '.04em',
}

const sFilaValor = {
    margin: 0, minWidth: 0,
    display: 'flex', flexDirection: 'column', gap: 2,
    fontSize: 'var(--text-sm)', fontWeight: 600,
    lineHeight: 1.4,
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
}

/** Dato secundario que cuelga de otro — la fecha de emisión bajo el folio. */
const sFilaPie = {
    fontSize: 10, fontWeight: 500, color: 'var(--text-disabled)',
    letterSpacing: 0, textTransform: 'none',
}

const sFolioChip = {
    display: 'inline-block', marginTop: 14,
    padding: '5px 13px',
    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
    fontSize: 13, letterSpacing: '.08em',
    color: 'var(--text-secondary)',
    background: 'rgba(127,127,127,.10)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-full)',
    wordBreak: 'break-all',
}

const sPie = {
    marginTop: 16, paddingTop: 12, marginBottom: 0,
    borderTop: '1px solid var(--border-subtle)',
    fontSize: 10, lineHeight: 1.6, textAlign: 'center',
    color: 'var(--text-muted)',
}

const sBtn = {
    background: 'var(--color-jade-500)', color: '#FAF7F2',
    border: 'none', borderRadius: 'var(--radius-full)',
    padding: '9px 20px', fontWeight: 700, fontSize: 'var(--text-sm)',
    fontFamily: 'var(--font-sans)', cursor: 'pointer',
}

const sSpinner = {
    width: 30, height: 30, margin: '0 auto',
    border: '3px solid var(--border-subtle)',
    borderTopColor: 'var(--color-jade-400)',
    borderRadius: '50%',
    animation: 'cert-giro .8s linear infinite',
}
