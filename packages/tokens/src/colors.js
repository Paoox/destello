/**
 * Destello — Design Tokens · Colors
 * Paleta aprobada: Verde jade profundo + Ámbar cálido
 * Importar: import { colors } from '@destello/tokens'
 */

export const colors = {
  // ── Jade (Primario) ───────────────────────────────────────
  jade: {
    50:  '#E6F5F5',
    100: '#BFDFDF',
    200: '#8EC8C8',
    300: '#5CAEAE',
    400: '#2F9699',
    500: '#0D7377',   // ← BASE: Jade profundo
    600: '#0F766E',   // ← Variante Tailwind-like
    700: '#095C5F',
    800: '#064346',
    900: '#02292B',
    950: '#011718',
  },

  // ── Ámbar (Acento) ────────────────────────────────────────
  amber: {
    50:  '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B',   // ← Ámbar medio
    600: '#D97706',   // ← BASE: Ámbar cálido
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
    950: '#451A03',
  },

  // ── Fondo / Neutros oscuros ───────────────────────────────
  bg: {
    dark:     '#061A18',  // Fondo principal dark (negro verde)
    card:     '#0A2422',  // Cards sobre bg-dark
    card2:    '#0E2E2B',  // Cards secundarias
    surface:  '#122F2D',  // Superficies elevadas
    overlay:  'rgba(6,26,24,0.85)',
  },

  // ── Fondo claro (modo light futuro) ──────────────────────
  light: {
    base:    '#FAF7F2',   // Blanco crema cálido (nunca blanco puro)
    surface: '#F3EFE8',
    border:  '#E5DFD5',
  },

  // ── Tipografía ────────────────────────────────────────────
  text: {
    primary:   '#FAF7F2',
    secondary: '#C8D8D7',
    muted:     '#8DA8A6',
    disabled:  '#4A6E6C',
    inverse:   '#061A18',
  },

  // ── Estados / Semánticos ──────────────────────────────────
  status: {
    success: '#10B981',
    warning: '#F59E0B',
    error:   '#EF4444',
    info:    '#3B82F6',
  },

  // ── Bordes ────────────────────────────────────────────────
  border: {
    subtle:  'rgba(13,115,119,0.2)',
    default: 'rgba(13,115,119,0.35)',
    strong:  'rgba(13,115,119,0.6)',
  },

  // ── Transparencias jade (glassmorphism) ───────────────────
  jade_alpha: {
    5:  'rgba(13,115,119,0.05)',
    10: 'rgba(13,115,119,0.10)',
    15: 'rgba(13,115,119,0.15)',
    20: 'rgba(13,115,119,0.20)',
    30: 'rgba(13,115,119,0.30)',
  },
}

// CSS Custom Properties — pegar en :root
export const colorsCSSVars = `
  /* ── Jade ── */
  --color-jade-500: ${colors.jade[500]};
  --color-jade-600: ${colors.jade[600]};
  --color-jade-light: ${colors.jade[300]};

  /* ── Amber ── */
  --color-amber-500: ${colors.amber[500]};
  --color-amber-600: ${colors.amber[600]};

  /* ── Fondos ── */
  --bg-dark:    ${colors.bg.dark};
  --bg-card:    ${colors.bg.card};
  --bg-surface: ${colors.bg.surface};
  --bg-light:   ${colors.light.base};

  /* ── Texto ── */
  --text-primary:   ${colors.text.primary};
  --text-secondary: ${colors.text.secondary};
  --text-muted:     ${colors.text.muted};
  --text-disabled:  ${colors.text.disabled};

  /* ── Bordes ── */
  --border-subtle:  ${colors.border.subtle};
  --border-default: ${colors.border.default};
  --border-strong:  ${colors.border.strong};

  /* ── Estados ── */
  --color-success: ${colors.status.success};
  --color-warning: ${colors.status.warning};
  --color-error:   ${colors.status.error};
  --color-info:    ${colors.status.info};
`
