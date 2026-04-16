/**
 * Destello — Design Tokens · Spacing & Sizing
 * Sistema de 4px base
 */

// Escala base de espaciado (en rem, base 16px)
export const spacing = {
  0:    '0',
  px:   '1px',
  0.5:  '0.125rem',  // 2px
  1:    '0.25rem',   // 4px
  1.5:  '0.375rem',  // 6px
  2:    '0.5rem',    // 8px
  2.5:  '0.625rem',  // 10px
  3:    '0.75rem',   // 12px
  3.5:  '0.875rem',  // 14px
  4:    '1rem',      // 16px
  5:    '1.25rem',   // 20px
  6:    '1.5rem',    // 24px
  7:    '1.75rem',   // 28px
  8:    '2rem',      // 32px
  9:    '2.25rem',   // 36px
  10:   '2.5rem',    // 40px
  12:   '3rem',      // 48px
  14:   '3.5rem',    // 56px
  16:   '4rem',      // 64px
  20:   '5rem',      // 80px
  24:   '6rem',      // 96px
  32:   '8rem',      // 128px
  40:   '10rem',     // 160px
  48:   '12rem',     // 192px
  64:   '16rem',     // 256px
}

// Radios de borde
export const radius = {
  none: '0',
  sm:   '4px',
  md:   '8px',
  lg:   '12px',
  xl:   '16px',
  '2xl':'20px',
  '3xl':'24px',
  full: '9999px',
}

// Breakpoints responsive
export const breakpoints = {
  sm:  '640px',
  md:  '768px',
  lg:  '1024px',
  xl:  '1280px',
  '2xl': '1536px',
}

// Sombras
export const shadows = {
  sm:    '0 1px 2px rgba(6,26,24,0.5)',
  md:    '0 4px 16px rgba(6,26,24,0.4)',
  lg:    '0 8px 32px rgba(6,26,24,0.5)',
  jade:  '0 0 20px rgba(13,115,119,0.25)',
  amber: '0 0 20px rgba(217,119,6,0.3)',
  glow:  '0 0 40px rgba(13,115,119,0.4)',
}

// Z-index
export const zIndex = {
  base:     0,
  raised:   10,
  overlay:  100,
  modal:    200,
  dropdown: 300,
  tooltip:  400,
  toast:    500,
}

// CSS Custom Properties
export const spacingCSSVars = `
  /* ── Spacing ── */
  --space-1:  ${spacing[1]};
  --space-2:  ${spacing[2]};
  --space-3:  ${spacing[3]};
  --space-4:  ${spacing[4]};
  --space-5:  ${spacing[5]};
  --space-6:  ${spacing[6]};
  --space-8:  ${spacing[8]};
  --space-10: ${spacing[10]};
  --space-12: ${spacing[12]};
  --space-16: ${spacing[16]};
  --space-20: ${spacing[20]};
  --space-24: ${spacing[24]};

  /* ── Radios ── */
  --radius-sm:   ${radius.sm};
  --radius-md:   ${radius.md};
  --radius-lg:   ${radius.lg};
  --radius-xl:   ${radius.xl};
  --radius-2xl:  ${radius['2xl']};
  --radius-full: ${radius.full};

  /* ── Sombras ── */
  --shadow-sm:    ${shadows.sm};
  --shadow-md:    ${shadows.md};
  --shadow-lg:    ${shadows.lg};
  --shadow-jade:  ${shadows.jade};
  --shadow-amber: ${shadows.amber};
  --shadow-glow:  ${shadows.glow};
`
