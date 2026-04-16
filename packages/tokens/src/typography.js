/**
 * Destello — Design Tokens · Typography
 * Tipografía base: Space Grotesk (headings + body)
 * Mono: JetBrains Mono (código, datos, labels técnicos)
 */

export const typography = {
  // ── Familias ──────────────────────────────────────────────
  fonts: {
    sans:    '"Space Grotesk", system-ui, -apple-system, sans-serif',
    mono:    '"JetBrains Mono", "Fira Code", monospace',
    display: '"Space Grotesk", sans-serif',
  },

  // ── Pesos ────────────────────────────────────────────────
  weight: {
    light:    300,
    regular:  400,
    medium:   500,
    semibold: 600,
    bold:     700,
  },

  // ── Escala de tamaños (rem) ───────────────────────────────
  size: {
    xs:   '0.75rem',    // 12px
    sm:   '0.875rem',   // 14px
    base: '1rem',       // 16px
    md:   '1.0625rem',  // 17px
    lg:   '1.125rem',   // 18px
    xl:   '1.25rem',    // 20px
    '2xl':'1.5rem',     // 24px
    '3xl':'1.875rem',   // 30px
    '4xl':'2.25rem',    // 36px
    '5xl':'3rem',       // 48px
    '6xl':'3.75rem',    // 60px
    '7xl':'4.5rem',     // 72px
  },

  // ── Altura de línea ───────────────────────────────────────
  leading: {
    tight:   1.2,
    snug:    1.375,
    normal:  1.5,
    relaxed: 1.625,
    loose:   2,
  },

  // ── Espaciado de letras ───────────────────────────────────
  tracking: {
    tight:  '-0.025em',
    normal: '0',
    wide:   '0.025em',
    wider:  '0.05em',
    widest: '0.1em',
  },
}

// CSS Custom Properties
export const typographyCSSVars = `
  --font-sans:    ${typography.fonts.sans};
  --font-mono:    ${typography.fonts.mono};
  --font-display: ${typography.fonts.display};

  --text-xs:   ${typography.size.xs};
  --text-sm:   ${typography.size.sm};
  --text-base: ${typography.size.base};
  --text-lg:   ${typography.size.lg};
  --text-xl:   ${typography.size.xl};
  --text-2xl:  ${typography.size['2xl']};
  --text-3xl:  ${typography.size['3xl']};
  --text-4xl:  ${typography.size['4xl']};
  --text-5xl:  ${typography.size['5xl']};

  --font-light:    ${typography.weight.light};
  --font-regular:  ${typography.weight.regular};
  --font-medium:   ${typography.weight.medium};
  --font-semibold: ${typography.weight.semibold};
  --font-bold:     ${typography.weight.bold};
`
