/**
 * Destello — @destello/tokens
 * Exporta todos los design tokens del sistema
 *
 * Uso:
 *   import { colors, typography, spacing } from '@destello/tokens'
 *   import { cssVars } from '@destello/tokens'
 */

export { colors, colorsCSSVars }       from './colors.js'
export { typography, typographyCSSVars } from './typography.js'
export { spacing, radius, breakpoints, shadows, zIndex, spacingCSSVars } from './spacing.js'

// CSS String completo — inyectar en :root desde main.jsx
import { colorsCSSVars }     from './colors.js'
import { typographyCSSVars } from './typography.js'
import { spacingCSSVars }    from './spacing.js'

export const cssVars = `
  /* ════════════════════════════════════════
     Destello Design Tokens — CSS Variables
     Autogenerado por @destello/tokens
     ════════════════════════════════════════ */
  ${colorsCSSVars}
  ${typographyCSSVars}
  ${spacingCSSVars}
`
