import { colors } from '../tokens/colors.js';
import { typography } from '../tokens/typography.js';
import { radii } from '../tokens/radii.js';
import { shadows } from '../tokens/shadows.js';

/**
 * Tailwind CSS preset that maps RunContext design tokens to Tailwind theme values.
 */
export const runcontextPreset = {
  theme: {
    extend: {
      colors: {
        'brand-gold': colors.brand.gold,
        'brand-gold-light': colors.brand.goldLight,
        'brand-gold-dim': colors.brand.goldDim,
        'surface-bg': colors.surface.bg,
        'surface-card': colors.surface.card,
        'surface-card-hover': colors.surface.cardHover,
        'surface-border': colors.border.default,
        'surface-border-hover': colors.border.hover,
        'text-primary': colors.text.primary,
        'text-secondary': colors.text.secondary,
        'text-muted': colors.text.muted,
        'tier-gold': colors.tier.gold,
        'tier-silver': colors.tier.silver,
        'tier-bronze': colors.tier.bronze,
        'status-success': colors.status.success,
        'status-error': colors.status.error,
        'status-warning': colors.status.warning,
        'status-info': colors.status.info,
      },
      fontFamily: {
        sans: typography.fontFamily.sans.split(',').map((s) => s.trim()),
        mono: typography.fontFamily.mono.split(',').map((s) => s.trim()),
      },
      borderRadius: {
        sm: radii.sm,
        md: radii.md,
        lg: radii.lg,
      },
      boxShadow: {
        sm: shadows.sm,
        md: shadows.md,
        lg: shadows.lg,
      },
    },
  },
} as const;

/**
 * Ready-to-paste Tailwind CSS 4 `@theme inline` block containing all RunContext tokens.
 */
export const themeInlineCSS = `@theme inline {
  --color-brand-gold: ${colors.brand.gold};
  --color-brand-gold-light: ${colors.brand.goldLight};
  --color-brand-gold-dim: ${colors.brand.goldDim};
  --color-surface-bg: ${colors.surface.bg};
  --color-surface-card: ${colors.surface.card};
  --color-surface-card-hover: ${colors.surface.cardHover};
  --color-surface-border: ${colors.border.default};
  --color-surface-border-hover: ${colors.border.hover};
  --color-text-primary: ${colors.text.primary};
  --color-text-secondary: ${colors.text.secondary};
  --color-text-muted: ${colors.text.muted};
  --color-tier-gold: ${colors.tier.gold};
  --color-tier-silver: ${colors.tier.silver};
  --color-tier-bronze: ${colors.tier.bronze};
  --color-status-success: ${colors.status.success};
  --color-status-error: ${colors.status.error};
  --color-status-warning: ${colors.status.warning};
  --color-status-info: ${colors.status.info};
  --font-family-sans: ${typography.fontFamily.sans};
  --font-family-mono: ${typography.fontFamily.mono};
  --radius-sm: ${radii.sm};
  --radius-md: ${radii.md};
  --radius-lg: ${radii.lg};
  --shadow-sm: ${shadows.sm};
  --shadow-md: ${shadows.md};
  --shadow-lg: ${shadows.lg};
}`;
