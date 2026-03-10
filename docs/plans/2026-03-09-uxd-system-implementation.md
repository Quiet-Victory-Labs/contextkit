# RunContext UXD System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a standalone `@runcontext/uxd` package providing design tokens, CSS components, a Tailwind preset, and React components — shared across all RunContext UI surfaces.

**Architecture:** TypeScript token definitions are the single source of truth. A build step generates CSS variables, component classes, and a Tailwind preset. React components wrap the CSS classes. All 4 repos consume the package via npm.

**Tech Stack:** TypeScript, tsup, React 19, Tailwind CSS 4, vitest

**Repo location:** `/Users/erickittelson/Code/RunContext/runcontext-uxd`

---

### Task 1: Scaffold the package

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/index.ts`

**Step 1: Create the repo directory**

```bash
mkdir -p /Users/erickittelson/Code/RunContext/runcontext-uxd
cd /Users/erickittelson/Code/RunContext/runcontext-uxd
git init
```

**Step 2: Create package.json**

```json
{
  "name": "@runcontext/uxd",
  "version": "0.1.0",
  "description": "Design tokens, CSS components, Tailwind preset, and React components for RunContext.",
  "license": "MIT",
  "author": "Eric Kittelson",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/tokens/index.js",
      "types": "./dist/tokens/index.d.ts"
    },
    "./css": "./dist/css/index.css",
    "./css/tokens": "./dist/css/tokens.css",
    "./tailwind": {
      "import": "./dist/tailwind/preset.js",
      "types": "./dist/tailwind/preset.d.ts"
    },
    "./react": {
      "import": "./dist/react/index.js",
      "types": "./dist/react/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "pnpm build:tokens && pnpm build:css && pnpm build:ts",
    "build:tokens": "tsx scripts/generate-css.ts",
    "build:css": "cat src/css/tokens.css src/css/components.css src/css/utilities.css > dist/css/index.css && cp src/css/tokens.css dist/css/tokens.css",
    "build:ts": "tsup",
    "clean": "rm -rf dist",
    "dev": "tsup --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {},
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tsup": "^8.4.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.0"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-dom": ">=18.0.0"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true }
  }
}
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["dist", "node_modules", "**/__tests__"]
}
```

**Step 4: Create tsup.config.ts**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig([
  // Tokens (plain JS, no React)
  {
    entry: { 'tokens/index': 'src/tokens/index.ts' },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
  },
  // Tailwind preset (plain JS, no React)
  {
    entry: { 'tailwind/preset': 'src/tailwind/preset.ts' },
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: false,
  },
  // React components
  {
    entry: { 'react/index': 'src/react/index.ts' },
    format: ['esm'],
    dts: true,
    splitting: true,
    sourcemap: true,
    clean: false,
    external: ['react', 'react-dom'],
  },
]);
```

**Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/__tests__/**/*.test.tsx'],
    environment: 'node',
  },
});
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
*.tsbuildinfo
```

**Step 7: Create placeholder entry**

```typescript
// src/index.ts
export * from './tokens/index.js';
```

**Step 8: Install dependencies and verify build**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext-uxd
pnpm install
```

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold @runcontext/uxd package"
```

---

### Task 2: Design tokens

**Files:**
- Create: `src/tokens/colors.ts`
- Create: `src/tokens/typography.ts`
- Create: `src/tokens/spacing.ts`
- Create: `src/tokens/radii.ts`
- Create: `src/tokens/shadows.ts`
- Create: `src/tokens/index.ts`
- Create: `src/tokens/__tests__/tokens.test.ts`

**Step 1: Write the test**

```typescript
// src/tokens/__tests__/tokens.test.ts
import { describe, it, expect } from 'vitest';
import { colors, typography, spacing, radii, shadows } from '../index.js';

describe('design tokens', () => {
  it('exports brand gold color', () => {
    expect(colors.brand.gold).toBe('#c9a55a');
  });

  it('exports all surface colors', () => {
    expect(colors.surface.bg).toBe('#0a0908');
    expect(colors.surface.card).toBe('#121110');
    expect(colors.surface.cardHover).toBe('#1e1c18');
  });

  it('exports all border colors', () => {
    expect(colors.border.default).toBe('#36342e');
    expect(colors.border.hover).toBe('#6a675e');
  });

  it('exports all text colors', () => {
    expect(colors.text.primary).toBe('#e8e6e1');
    expect(colors.text.secondary).toBe('#9a978e');
    expect(colors.text.muted).toBe('#6a675e');
  });

  it('exports tier colors', () => {
    expect(colors.tier.gold).toBe('#c9a55a');
    expect(colors.tier.silver).toBe('#a0a8b8');
    expect(colors.tier.bronze).toBe('#b87a4a');
  });

  it('exports status colors', () => {
    expect(colors.status.success).toBe('#22c55e');
    expect(colors.status.error).toBe('#ef4444');
    expect(colors.status.warning).toBe('#eab308');
    expect(colors.status.info).toBe('#4f9eff');
  });

  it('exports font families', () => {
    expect(typography.fontFamily.sans).toContain('Plus Jakarta Sans');
    expect(typography.fontFamily.mono).toContain('Geist Mono');
  });

  it('exports font sizes', () => {
    expect(typography.fontSize.base).toBe('1rem');
    expect(typography.fontSize.sm).toBe('0.875rem');
  });

  it('exports spacing values on 4px grid', () => {
    expect(spacing[1]).toBe('0.25rem');
    expect(spacing[2]).toBe('0.5rem');
    expect(spacing[4]).toBe('1rem');
  });

  it('exports border radii', () => {
    expect(radii.sm).toBe('4px');
    expect(radii.md).toBe('8px');
    expect(radii.lg).toBe('12px');
    expect(radii.full).toBe('9999px');
  });

  it('exports shadows', () => {
    expect(shadows.sm).toContain('rgba');
    expect(shadows.md).toContain('rgba');
    expect(shadows.lg).toContain('rgba');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — modules don't exist yet.

**Step 3: Create color tokens**

```typescript
// src/tokens/colors.ts
export const colors = {
  brand: {
    gold: '#c9a55a',
    goldLight: '#f5e6c0',
    goldDim: '#1a1508',
  },
  surface: {
    bg: '#0a0908',
    card: '#121110',
    cardHover: '#1e1c18',
  },
  border: {
    default: '#36342e',
    hover: '#6a675e',
  },
  text: {
    primary: '#e8e6e1',
    secondary: '#9a978e',
    muted: '#6a675e',
  },
  tier: {
    gold: '#c9a55a',
    silver: '#a0a8b8',
    bronze: '#b87a4a',
  },
  status: {
    success: '#22c55e',
    error: '#ef4444',
    warning: '#eab308',
    info: '#4f9eff',
  },
} as const;
```

**Step 4: Create typography tokens**

```typescript
// src/tokens/typography.ts
export const typography = {
  fontFamily: {
    sans: "'Plus Jakarta Sans', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "'Geist Mono', 'SF Mono', Consolas, 'Liberation Mono', monospace",
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '2rem',
  },
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  lineHeight: {
    tight: '1.25',
    normal: '1.5',
    relaxed: '1.625',
  },
} as const;
```

**Step 5: Create spacing tokens**

```typescript
// src/tokens/spacing.ts
/** Spacing scale based on 4px grid. Keys are multipliers (1 = 4px = 0.25rem). */
export const spacing = {
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const;
```

**Step 6: Create radii tokens**

```typescript
// src/tokens/radii.ts
export const radii = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  full: '9999px',
} as const;
```

**Step 7: Create shadow tokens**

```typescript
// src/tokens/shadows.ts
export const shadows = {
  sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
  md: '0 2px 8px rgba(0, 0, 0, 0.4)',
  lg: '0 4px 16px rgba(0, 0, 0, 0.5)',
} as const;
```

**Step 8: Create barrel export**

```typescript
// src/tokens/index.ts
export { colors } from './colors.js';
export { typography } from './typography.js';
export { spacing } from './spacing.js';
export { radii } from './radii.js';
export { shadows } from './shadows.js';
```

**Step 9: Update src/index.ts**

```typescript
// src/index.ts
export * from './tokens/index.js';
```

**Step 10: Run tests to verify they pass**

```bash
pnpm test
```

Expected: All tests PASS.

**Step 11: Commit**

```bash
git add -A
git commit -m "feat: add design tokens (colors, typography, spacing, radii, shadows)"
```

---

### Task 3: CSS generation from tokens

**Files:**
- Create: `scripts/generate-css.ts`
- Create: `src/css/components.css`
- Create: `src/css/utilities.css`

This task generates `src/css/tokens.css` from the TypeScript token definitions, and creates hand-authored component + utility CSS files that reference the generated variables.

**Step 1: Create the CSS generator script**

```typescript
// scripts/generate-css.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { colors } from '../src/tokens/colors.js';
import { typography } from '../src/tokens/typography.js';
import { spacing } from '../src/tokens/spacing.js';
import { radii } from '../src/tokens/radii.js';
import { shadows } from '../src/tokens/shadows.js';

function flattenObject(obj: Record<string, unknown>, prefix: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const varName = prefix ? `${prefix}-${kebab(key)}` : kebab(key);
    if (typeof value === 'object' && value !== null) {
      entries.push(...flattenObject(value as Record<string, unknown>, varName));
    } else {
      entries.push([varName, String(value)]);
    }
  }
  return entries;
}

function kebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

const lines: string[] = ['/* Auto-generated from @runcontext/uxd tokens. Do not edit. */', '', ':root {'];

for (const [name, value] of flattenObject(colors, 'rc-color')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');

for (const [name, value] of flattenObject(typography.fontFamily, 'rc-font')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');

for (const [name, value] of flattenObject(typography.fontSize, 'rc-text')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');

for (const [name, value] of flattenObject(typography.fontWeight, 'rc-font-weight')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');

for (const [name, value] of flattenObject(typography.lineHeight, 'rc-leading')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');

for (const [key, value] of Object.entries(spacing)) {
  lines.push(`  --rc-space-${String(key).replace('.', '_')}: ${value};`);
}
lines.push('');

for (const [name, value] of flattenObject(radii, 'rc-radius')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');

for (const [name, value] of flattenObject(shadows, 'rc-shadow')) {
  lines.push(`  --${name}: ${value};`);
}

lines.push('}');

mkdirSync('src/css', { recursive: true });
mkdirSync('dist/css', { recursive: true });
writeFileSync('src/css/tokens.css', lines.join('\n') + '\n');
console.log('Generated src/css/tokens.css');
```

**Step 2: Create components.css**

```css
/* src/css/components.css */
/* Component classes for non-React surfaces (wizard, catalog, cloud studio). */
/* React consumers use these same classes via the React component wrappers. */

/* ---- Reset ---- */

.rc-reset *, .rc-reset *::before, .rc-reset *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

.rc-reset {
  font-family: var(--rc-font-sans);
  background: var(--rc-color-surface-bg);
  color: var(--rc-color-text-primary);
  line-height: var(--rc-leading-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ---- Button ---- */

.rc-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--rc-space-2);
  border: 1px solid transparent;
  border-radius: var(--rc-radius-md);
  font-family: var(--rc-font-sans);
  font-weight: var(--rc-font-weight-medium);
  cursor: pointer;
  transition: background-color 150ms, border-color 150ms, color 150ms;
  white-space: nowrap;
  text-decoration: none;
  line-height: 1;
}

.rc-btn:focus-visible {
  outline: 2px solid var(--rc-color-brand-gold);
  outline-offset: 2px;
}

.rc-btn--sm { font-size: var(--rc-text-sm); padding: var(--rc-space-1_5) var(--rc-space-3); }
.rc-btn--md { font-size: var(--rc-text-sm); padding: var(--rc-space-2) var(--rc-space-4); }
.rc-btn--lg { font-size: var(--rc-text-base); padding: var(--rc-space-3) var(--rc-space-6); }

.rc-btn--primary {
  background: var(--rc-color-brand-gold);
  color: var(--rc-color-surface-bg);
}
.rc-btn--primary:hover { background: var(--rc-color-brand-gold-light); }

.rc-btn--secondary {
  background: transparent;
  border-color: var(--rc-color-border-default);
  color: var(--rc-color-text-primary);
}
.rc-btn--secondary:hover {
  border-color: var(--rc-color-border-hover);
  background: var(--rc-color-surface-card);
}

.rc-btn--ghost {
  background: transparent;
  color: var(--rc-color-text-secondary);
}
.rc-btn--ghost:hover {
  color: var(--rc-color-text-primary);
  background: var(--rc-color-surface-card);
}

.rc-btn--danger {
  background: var(--rc-color-status-error);
  color: #fff;
}
.rc-btn--danger:hover { opacity: 0.9; }

.rc-btn:disabled, .rc-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

/* ---- Card ---- */

.rc-card {
  border: 1px solid var(--rc-color-border-default);
  border-radius: var(--rc-radius-md);
  background: var(--rc-color-surface-card);
  padding: var(--rc-space-5);
}

.rc-card--interactive {
  cursor: pointer;
  transition: border-color 150ms, background-color 150ms;
}
.rc-card--interactive:hover {
  border-color: var(--rc-color-border-hover);
  background: var(--rc-color-surface-card-hover);
}

/* ---- Stat Card ---- */

.rc-stat-card {
  border: 1px solid var(--rc-color-border-default);
  border-radius: var(--rc-radius-md);
  background: var(--rc-color-surface-card);
  padding: var(--rc-space-5);
}

.rc-stat-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.rc-stat-card__label {
  font-size: var(--rc-text-sm);
  color: var(--rc-color-text-muted);
}

.rc-stat-card__value {
  margin-top: var(--rc-space-1);
  font-size: var(--rc-text-3xl);
  font-weight: var(--rc-font-weight-semibold);
  color: var(--rc-color-text-primary);
}

.rc-stat-card__icon {
  color: var(--rc-color-text-muted);
  width: 1.25rem;
  height: 1.25rem;
}

/* ---- Badge ---- */

.rc-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--rc-space-1);
  border-radius: var(--rc-radius-full);
  font-size: var(--rc-text-xs);
  font-weight: var(--rc-font-weight-medium);
  padding: var(--rc-space-0_5) var(--rc-space-2);
  line-height: 1;
}

.rc-badge--gold { background: rgba(201, 165, 90, 0.15); color: var(--rc-color-tier-gold); border: 1px solid rgba(201, 165, 90, 0.3); }
.rc-badge--silver { background: rgba(160, 168, 184, 0.12); color: var(--rc-color-tier-silver); border: 1px solid rgba(160, 168, 184, 0.25); }
.rc-badge--bronze { background: rgba(184, 122, 74, 0.15); color: var(--rc-color-tier-bronze); border: 1px solid rgba(184, 122, 74, 0.3); }

.rc-badge--success { background: rgba(34, 197, 94, 0.12); color: var(--rc-color-status-success); border: 1px solid rgba(34, 197, 94, 0.25); }
.rc-badge--error { background: rgba(239, 68, 68, 0.12); color: var(--rc-color-status-error); border: 1px solid rgba(239, 68, 68, 0.25); }
.rc-badge--warning { background: rgba(234, 179, 8, 0.12); color: var(--rc-color-status-warning); border: 1px solid rgba(234, 179, 8, 0.25); }
.rc-badge--info { background: rgba(79, 158, 255, 0.12); color: var(--rc-color-status-info); border: 1px solid rgba(79, 158, 255, 0.25); }

/* ---- Input / Select / Textarea ---- */

.rc-input, .rc-select, .rc-textarea {
  width: 100%;
  padding: var(--rc-space-2) var(--rc-space-3);
  background: var(--rc-color-surface-bg);
  border: 1px solid var(--rc-color-border-default);
  border-radius: var(--rc-radius-md);
  color: var(--rc-color-text-primary);
  font-family: var(--rc-font-sans);
  font-size: var(--rc-text-sm);
  transition: border-color 150ms;
}

.rc-input:focus, .rc-select:focus, .rc-textarea:focus {
  outline: none;
  border-color: var(--rc-color-brand-gold);
  box-shadow: 0 0 0 3px rgba(201, 165, 90, 0.15);
}

.rc-input::placeholder, .rc-textarea::placeholder {
  color: var(--rc-color-text-muted);
}

.rc-textarea { min-height: 5rem; resize: vertical; }

.rc-input--error, .rc-select--error, .rc-textarea--error {
  border-color: var(--rc-color-status-error);
}
.rc-input--error:focus, .rc-select--error:focus, .rc-textarea--error:focus {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.15);
}

/* ---- Sidebar ---- */

.rc-sidebar {
  position: fixed;
  inset: 0 auto 0 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  width: 15rem;
  border-right: 1px solid var(--rc-color-border-default);
  background: var(--rc-color-surface-bg);
}

.rc-sidebar__logo {
  display: flex;
  align-items: center;
  gap: var(--rc-space-2);
  height: 3.5rem;
  padding: 0 var(--rc-space-5);
  text-decoration: none;
}

.rc-sidebar__logo-text {
  font-size: var(--rc-text-lg);
  font-weight: var(--rc-font-weight-bold);
  letter-spacing: -0.02em;
  color: var(--rc-color-text-primary);
}

.rc-sidebar__logo-accent {
  color: var(--rc-color-brand-gold);
}

.rc-sidebar__nav {
  flex: 1;
  padding: var(--rc-space-4) var(--rc-space-3);
  display: flex;
  flex-direction: column;
  gap: var(--rc-space-1);
  overflow-y: auto;
}

.rc-sidebar__item {
  display: flex;
  align-items: center;
  gap: var(--rc-space-3);
  padding: var(--rc-space-2) var(--rc-space-3);
  border-radius: var(--rc-radius-md);
  font-size: var(--rc-text-sm);
  font-weight: var(--rc-font-weight-medium);
  color: var(--rc-color-text-secondary);
  text-decoration: none;
  transition: color 150ms, background-color 150ms;
}

.rc-sidebar__item:hover {
  color: var(--rc-color-text-primary);
}

.rc-sidebar__item--active {
  background: rgba(201, 165, 90, 0.1);
  color: var(--rc-color-brand-gold);
}

.rc-sidebar__divider {
  margin-top: var(--rc-space-4);
  padding-top: var(--rc-space-4);
  border-top: 1px solid var(--rc-color-border-default);
}

.rc-sidebar__footer {
  border-top: 1px solid var(--rc-color-border-default);
  padding: var(--rc-space-4);
}

.rc-sidebar__footer-label {
  font-size: 0.625rem;
  font-weight: var(--rc-font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--rc-color-text-muted);
  margin-bottom: var(--rc-space-1);
}

.rc-sidebar__footer-value {
  font-family: var(--rc-font-mono);
  font-size: var(--rc-text-xs);
  color: var(--rc-color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- Top Bar ---- */

.rc-topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 3.5rem;
  border-bottom: 1px solid var(--rc-color-border-default);
  background: var(--rc-color-surface-bg);
  padding: 0 var(--rc-space-6);
}

.rc-topbar__actions {
  display: flex;
  align-items: center;
  gap: var(--rc-space-4);
}

/* ---- Progress Bar ---- */

.rc-progress {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  position: relative;
}

.rc-progress::before {
  content: '';
  position: absolute;
  top: 1rem;
  left: 2rem;
  right: 2rem;
  height: 2px;
  background: var(--rc-color-border-default);
}

.rc-progress__step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rc-space-1);
  position: relative;
  z-index: 1;
  flex: 1;
}

.rc-progress__dot {
  width: 2rem;
  height: 2rem;
  border-radius: var(--rc-radius-full);
  border: 2px solid var(--rc-color-border-default);
  background: var(--rc-color-surface-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--rc-text-xs);
  font-weight: var(--rc-font-weight-semibold);
  color: var(--rc-color-text-muted);
  transition: all 200ms;
}

.rc-progress__step--active .rc-progress__dot {
  border-color: var(--rc-color-brand-gold);
  color: var(--rc-color-brand-gold);
}

.rc-progress__step--completed .rc-progress__dot {
  background: var(--rc-color-brand-gold);
  border-color: var(--rc-color-brand-gold);
  color: var(--rc-color-surface-bg);
}

.rc-progress__label {
  font-size: var(--rc-text-xs);
  color: var(--rc-color-text-muted);
  text-align: center;
}

.rc-progress__step--active .rc-progress__label {
  color: var(--rc-color-brand-gold);
}

/* ---- Activity Feed ---- */

.rc-activity-feed {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--rc-space-4);
  padding: 0;
  margin: 0;
}

.rc-activity-feed__item {
  display: flex;
  align-items: flex-start;
  gap: var(--rc-space-3);
}

.rc-activity-feed__dot {
  margin-top: var(--rc-space-1_5);
  width: 0.5rem;
  height: 0.5rem;
  border-radius: var(--rc-radius-full);
  background: var(--rc-color-brand-gold);
  flex-shrink: 0;
}

.rc-activity-feed__message {
  font-size: var(--rc-text-sm);
  color: var(--rc-color-text-primary);
}

.rc-activity-feed__meta {
  margin-top: var(--rc-space-0_5);
  font-size: var(--rc-text-xs);
  color: var(--rc-color-text-muted);
}

/* ---- Code Block ---- */

.rc-code {
  background: var(--rc-color-surface-bg);
  border: 1px solid var(--rc-color-border-default);
  border-radius: var(--rc-radius-md);
  padding: var(--rc-space-4);
  overflow-x: auto;
  font-family: var(--rc-font-mono);
  font-size: var(--rc-text-sm);
  color: var(--rc-color-text-primary);
  line-height: var(--rc-leading-relaxed);
}

/* ---- Empty State ---- */

.rc-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--rc-space-3);
  padding: var(--rc-space-10);
  text-align: center;
}

.rc-empty__icon {
  color: var(--rc-color-text-muted);
  width: 2.5rem;
  height: 2.5rem;
}

.rc-empty__message {
  font-size: var(--rc-text-sm);
  color: var(--rc-color-text-muted);
}

/* ---- Loading Spinner ---- */

.rc-spinner {
  display: inline-block;
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid var(--rc-color-border-default);
  border-top-color: var(--rc-color-brand-gold);
  border-radius: var(--rc-radius-full);
  animation: rc-spin 600ms linear infinite;
}

@keyframes rc-spin {
  to { transform: rotate(360deg); }
}

/* ---- Error Card ---- */

.rc-error-card {
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--rc-radius-md);
  background: rgba(239, 68, 68, 0.05);
  padding: var(--rc-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--rc-space-3);
}

.rc-error-card__message {
  font-size: var(--rc-text-sm);
  color: var(--rc-color-status-error);
}
```

**Step 3: Create utilities.css**

```css
/* src/css/utilities.css */
/* Utility classes for common patterns. */

/* Text colors */
.rc-text-primary { color: var(--rc-color-text-primary); }
.rc-text-secondary { color: var(--rc-color-text-secondary); }
.rc-text-muted { color: var(--rc-color-text-muted); }
.rc-text-brand { color: var(--rc-color-brand-gold); }

/* Text sizes */
.rc-text-xs { font-size: var(--rc-text-xs); }
.rc-text-sm { font-size: var(--rc-text-sm); }
.rc-text-base { font-size: var(--rc-text-base); }
.rc-text-lg { font-size: var(--rc-text-lg); }
.rc-text-xl { font-size: var(--rc-text-xl); }
.rc-text-2xl { font-size: var(--rc-text-2xl); }
.rc-text-3xl { font-size: var(--rc-text-3xl); }

/* Font families */
.rc-font-sans { font-family: var(--rc-font-sans); }
.rc-font-mono { font-family: var(--rc-font-mono); }

/* Tier colors */
.rc-tier-gold { color: var(--rc-color-tier-gold); }
.rc-tier-silver { color: var(--rc-color-tier-silver); }
.rc-tier-bronze { color: var(--rc-color-tier-bronze); }

/* Status colors */
.rc-status-success { color: var(--rc-color-status-success); }
.rc-status-error { color: var(--rc-color-status-error); }
.rc-status-warning { color: var(--rc-color-status-warning); }
.rc-status-info { color: var(--rc-color-status-info); }

/* Background surfaces */
.rc-bg-surface { background: var(--rc-color-surface-bg); }
.rc-bg-card { background: var(--rc-color-surface-card); }

/* Truncation */
.rc-truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

**Step 4: Run the CSS generator**

```bash
pnpm build:tokens
```

Expected: `src/css/tokens.css` created with all CSS variables.

**Step 5: Verify dist/css output**

```bash
mkdir -p dist/css
pnpm build:css
cat dist/css/tokens.css | head -10
```

Expected: CSS variables in `:root {}` block.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add CSS generation from tokens + component and utility classes"
```

---

### Task 4: Tailwind preset

**Files:**
- Create: `src/tailwind/preset.ts`
- Create: `src/tailwind/__tests__/preset.test.ts`

**Step 1: Write the test**

```typescript
// src/tailwind/__tests__/preset.test.ts
import { describe, it, expect } from 'vitest';
import { runcontextPreset } from '../preset.js';

describe('tailwind preset', () => {
  it('exports a valid preset object with theme', () => {
    expect(runcontextPreset).toHaveProperty('theme');
    expect(runcontextPreset.theme).toHaveProperty('extend');
  });

  it('maps brand gold to tailwind color', () => {
    const colors = runcontextPreset.theme!.extend!.colors as Record<string, unknown>;
    expect(colors['brand-gold']).toBe('#c9a55a');
  });

  it('maps surface colors', () => {
    const colors = runcontextPreset.theme!.extend!.colors as Record<string, unknown>;
    expect(colors['surface-bg']).toBe('#0a0908');
    expect(colors['surface-card']).toBe('#121110');
  });

  it('maps font families', () => {
    const fonts = runcontextPreset.theme!.extend!.fontFamily as Record<string, unknown>;
    expect(fonts.sans).toContain('Plus Jakarta Sans');
    expect(fonts.mono).toContain('Geist Mono');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL — module doesn't exist.

**Step 3: Create the preset**

```typescript
// src/tailwind/preset.ts
import { colors } from '../tokens/colors.js';
import { typography } from '../tokens/typography.js';
import { radii } from '../tokens/radii.js';
import { shadows } from '../tokens/shadows.js';

/**
 * Tailwind CSS 4 preset for RunContext.
 * Use in your CSS: @import "tailwindcss"; @theme { ... }
 * Or reference this preset for programmatic access to token values.
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
        sans: typography.fontFamily.sans.split(',').map(s => s.trim()),
        mono: typography.fontFamily.mono.split(',').map(s => s.trim()),
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
};

/**
 * Tailwind CSS 4 @theme inline block content.
 * Copy-paste into globals.css if you prefer inline theme over preset.
 */
export const themeInlineCSS = `
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

  --font-sans: ${typography.fontFamily.sans};
  --font-mono: ${typography.fontFamily.mono};
`;
```

**Step 4: Run tests**

```bash
pnpm test
```

Expected: All PASS.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add Tailwind CSS preset with token mappings"
```

---

### Task 5: React components

**Files:**
- Create: `src/react/Button.tsx`
- Create: `src/react/Card.tsx`
- Create: `src/react/StatCard.tsx`
- Create: `src/react/Badge.tsx`
- Create: `src/react/TierBadge.tsx`
- Create: `src/react/Input.tsx`
- Create: `src/react/ActivityFeed.tsx`
- Create: `src/react/EmptyState.tsx`
- Create: `src/react/Spinner.tsx`
- Create: `src/react/ErrorCard.tsx`
- Create: `src/react/CodeBlock.tsx`
- Create: `src/react/index.ts`
- Create: `src/react/__tests__/components.test.tsx`

React components are thin wrappers that apply the CSS classes from `components.css`. They accept props for variants, sizes, and content. No inline styles — all styling comes from the shared CSS.

**Step 1: Write the tests**

```tsx
// src/react/__tests__/components.test.tsx
import { describe, it, expect } from 'vitest';
import {
  Button,
  Card,
  StatCard,
  Badge,
  TierBadge,
  Input,
  Textarea,
  Select,
  ActivityFeed,
  EmptyState,
  Spinner,
  ErrorCard,
  CodeBlock,
} from '../index.js';

describe('react component exports', () => {
  it('exports Button', () => expect(Button).toBeDefined());
  it('exports Card', () => expect(Card).toBeDefined());
  it('exports StatCard', () => expect(StatCard).toBeDefined());
  it('exports Badge', () => expect(Badge).toBeDefined());
  it('exports TierBadge', () => expect(TierBadge).toBeDefined());
  it('exports Input', () => expect(Input).toBeDefined());
  it('exports Textarea', () => expect(Textarea).toBeDefined());
  it('exports Select', () => expect(Select).toBeDefined());
  it('exports ActivityFeed', () => expect(ActivityFeed).toBeDefined());
  it('exports EmptyState', () => expect(EmptyState).toBeDefined());
  it('exports Spinner', () => expect(Spinner).toBeDefined());
  it('exports ErrorCard', () => expect(ErrorCard).toBeDefined());
  it('exports CodeBlock', () => expect(CodeBlock).toBeDefined());
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test
```

Expected: FAIL.

**Step 3: Create Button.tsx**

```tsx
// src/react/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: ButtonProps) {
  const cls = `rc-btn rc-btn--${variant} rc-btn--${size} ${className}`.trim();
  return <button className={cls} {...props}>{children}</button>;
}
```

**Step 4: Create Card.tsx**

```tsx
// src/react/Card.tsx
import type { HTMLAttributes, ReactNode } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  children: ReactNode;
}

export function Card({ interactive = false, className = '', children, ...props }: CardProps) {
  const cls = `rc-card ${interactive ? 'rc-card--interactive' : ''} ${className}`.trim();
  return <div className={cls} {...props}>{children}</div>;
}
```

**Step 5: Create StatCard.tsx**

```tsx
// src/react/StatCard.tsx
import type { ReactNode } from 'react';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ label, value, icon, className = '' }: StatCardProps) {
  return (
    <div className={`rc-stat-card ${className}`.trim()}>
      <div className="rc-stat-card__header">
        <div>
          <p className="rc-stat-card__label">{label}</p>
          <p className="rc-stat-card__value">{value}</p>
        </div>
        {icon && <span className="rc-stat-card__icon">{icon}</span>}
      </div>
    </div>
  );
}
```

**Step 6: Create Badge.tsx**

```tsx
// src/react/Badge.tsx
import type { HTMLAttributes, ReactNode } from 'react';

export type BadgeVariant = 'gold' | 'silver' | 'bronze' | 'success' | 'error' | 'warning' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant;
  children: ReactNode;
}

export function Badge({ variant, className = '', children, ...props }: BadgeProps) {
  const cls = `rc-badge rc-badge--${variant} ${className}`.trim();
  return <span className={cls} {...props}>{children}</span>;
}
```

**Step 7: Create TierBadge.tsx**

```tsx
// src/react/TierBadge.tsx
import { Badge } from './Badge.js';

const TIER_LABELS: Record<string, string> = {
  gold: 'AI-Ready',
  silver: 'Trusted',
  bronze: 'Discoverable',
};

export interface TierBadgeProps {
  tier: 'gold' | 'silver' | 'bronze';
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  return <Badge variant={tier} className={className}>{TIER_LABELS[tier] ?? tier}</Badge>;
}
```

**Step 8: Create Input.tsx**

```tsx
// src/react/Input.tsx
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export function Input({ error = false, className = '', ...props }: InputProps) {
  const cls = `rc-input ${error ? 'rc-input--error' : ''} ${className}`.trim();
  return <input className={cls} {...props} />;
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error = false, className = '', ...props }: TextareaProps) {
  const cls = `rc-textarea ${error ? 'rc-textarea--error' : ''} ${className}`.trim();
  return <textarea className={cls} {...props} />;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export function Select({ error = false, className = '', children, ...props }: SelectProps) {
  const cls = `rc-select ${error ? 'rc-select--error' : ''} ${className}`.trim();
  return <select className={cls} {...props}>{children}</select>;
}
```

**Step 9: Create ActivityFeed.tsx**

```tsx
// src/react/ActivityFeed.tsx
export interface ActivityEvent {
  id: string;
  type: string;
  actor?: string;
  message: string;
  timestamp: string;
}

export interface ActivityFeedProps {
  events: ActivityEvent[];
  className?: string;
}

export function ActivityFeed({ events, className = '' }: ActivityFeedProps) {
  if (events.length === 0) {
    return <p className="rc-text-sm rc-text-muted">No recent activity.</p>;
  }

  return (
    <ul className={`rc-activity-feed ${className}`.trim()}>
      {events.map((event) => (
        <li key={event.id} className="rc-activity-feed__item">
          <span className="rc-activity-feed__dot" />
          <div>
            <p className="rc-activity-feed__message">{event.message}</p>
            <p className="rc-activity-feed__meta">
              {event.actor && <span>{event.actor} &middot; </span>}
              {new Date(event.timestamp).toLocaleDateString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

**Step 10: Create EmptyState.tsx**

```tsx
// src/react/EmptyState.tsx
import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  message: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, message, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`rc-empty ${className}`.trim()}>
      {icon && <span className="rc-empty__icon">{icon}</span>}
      <p className="rc-empty__message">{message}</p>
      {action}
    </div>
  );
}
```

**Step 11: Create Spinner.tsx**

```tsx
// src/react/Spinner.tsx
export interface SpinnerProps {
  className?: string;
}

export function Spinner({ className = '' }: SpinnerProps) {
  return <span className={`rc-spinner ${className}`.trim()} role="status" aria-label="Loading" />;
}
```

**Step 12: Create ErrorCard.tsx**

```tsx
// src/react/ErrorCard.tsx
import type { ReactNode } from 'react';

export interface ErrorCardProps {
  message: string;
  action?: ReactNode;
  className?: string;
}

export function ErrorCard({ message, action, className = '' }: ErrorCardProps) {
  return (
    <div className={`rc-error-card ${className}`.trim()}>
      <p className="rc-error-card__message">{message}</p>
      {action}
    </div>
  );
}
```

**Step 13: Create CodeBlock.tsx**

```tsx
// src/react/CodeBlock.tsx
export interface CodeBlockProps {
  code: string;
  className?: string;
}

export function CodeBlock({ code, className = '' }: CodeBlockProps) {
  return <pre className={`rc-code ${className}`.trim()}><code>{code}</code></pre>;
}
```

**Step 14: Create barrel export**

```typescript
// src/react/index.ts
export { Button } from './Button.js';
export type { ButtonProps } from './Button.js';

export { Card } from './Card.js';
export type { CardProps } from './Card.js';

export { StatCard } from './StatCard.js';
export type { StatCardProps } from './StatCard.js';

export { Badge } from './Badge.js';
export type { BadgeProps, BadgeVariant } from './Badge.js';

export { TierBadge } from './TierBadge.js';
export type { TierBadgeProps } from './TierBadge.js';

export { Input, Textarea, Select } from './Input.js';
export type { InputProps, TextareaProps, SelectProps } from './Input.js';

export { ActivityFeed } from './ActivityFeed.js';
export type { ActivityFeedProps, ActivityEvent } from './ActivityFeed.js';

export { EmptyState } from './EmptyState.js';
export type { EmptyStateProps } from './EmptyState.js';

export { Spinner } from './Spinner.js';
export type { SpinnerProps } from './Spinner.js';

export { ErrorCard } from './ErrorCard.js';
export type { ErrorCardProps } from './ErrorCard.js';

export { CodeBlock } from './CodeBlock.js';
export type { CodeBlockProps } from './CodeBlock.js';
```

**Step 15: Run tests**

```bash
pnpm test
```

Expected: All PASS.

**Step 16: Build the full package**

```bash
pnpm build
```

Expected: `dist/` contains `tokens/`, `tailwind/`, `react/`, `css/` directories.

**Step 17: Commit**

```bash
git add -A
git commit -m "feat: add React component library wrapping CSS classes"
```

---

### Task 6: Preview page

**Files:**
- Create: `dev.html`

A single HTML file that showcases all components with their variants, for visual verification during development.

**Step 1: Create dev.html**

```html
<!-- dev.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RunContext UXD — Component Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="dist/css/index.css" />
  <style>
    body { padding: 2rem; max-width: 900px; margin: 0 auto; }
    .section { margin-bottom: 3rem; }
    .section h2 { font-size: var(--rc-text-xl); margin-bottom: var(--rc-space-4); border-bottom: 1px solid var(--rc-color-border-default); padding-bottom: var(--rc-space-2); }
    .row { display: flex; gap: var(--rc-space-3); flex-wrap: wrap; align-items: center; margin-bottom: var(--rc-space-3); }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: var(--rc-space-4); }
    .swatch { width: 3rem; height: 3rem; border-radius: var(--rc-radius-md); border: 1px solid var(--rc-color-border-default); }
  </style>
</head>
<body class="rc-reset">
  <h1 style="margin-bottom: 2rem;">RunContext UXD Preview</h1>

  <div class="section">
    <h2>Buttons</h2>
    <div class="row">
      <button class="rc-btn rc-btn--primary rc-btn--sm">Primary SM</button>
      <button class="rc-btn rc-btn--primary rc-btn--md">Primary MD</button>
      <button class="rc-btn rc-btn--primary rc-btn--lg">Primary LG</button>
    </div>
    <div class="row">
      <button class="rc-btn rc-btn--secondary rc-btn--md">Secondary</button>
      <button class="rc-btn rc-btn--ghost rc-btn--md">Ghost</button>
      <button class="rc-btn rc-btn--danger rc-btn--md">Danger</button>
      <button class="rc-btn rc-btn--primary rc-btn--md" disabled>Disabled</button>
    </div>
  </div>

  <div class="section">
    <h2>Badges</h2>
    <div class="row">
      <span class="rc-badge rc-badge--gold">AI-Ready</span>
      <span class="rc-badge rc-badge--silver">Trusted</span>
      <span class="rc-badge rc-badge--bronze">Discoverable</span>
    </div>
    <div class="row">
      <span class="rc-badge rc-badge--success">Success</span>
      <span class="rc-badge rc-badge--error">Error</span>
      <span class="rc-badge rc-badge--warning">Warning</span>
      <span class="rc-badge rc-badge--info">Info</span>
    </div>
  </div>

  <div class="section">
    <h2>Cards</h2>
    <div class="grid">
      <div class="rc-card">
        <p class="rc-text-sm rc-text-muted">Default card</p>
        <p style="margin-top: var(--rc-space-2);">Content goes here.</p>
      </div>
      <div class="rc-card rc-card--interactive">
        <p class="rc-text-sm rc-text-muted">Interactive card</p>
        <p style="margin-top: var(--rc-space-2);">Hover me.</p>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Stat Cards</h2>
    <div class="grid">
      <div class="rc-stat-card">
        <div class="rc-stat-card__header">
          <div>
            <p class="rc-stat-card__label">Semantic Planes</p>
            <p class="rc-stat-card__value">12</p>
          </div>
        </div>
      </div>
      <div class="rc-stat-card">
        <div class="rc-stat-card__header">
          <div>
            <p class="rc-stat-card__label">MCP Requests</p>
            <p class="rc-stat-card__value">1,284</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Form Controls</h2>
    <div style="display: flex; flex-direction: column; gap: var(--rc-space-3); max-width: 400px;">
      <input class="rc-input" placeholder="Default input" />
      <input class="rc-input rc-input--error" placeholder="Error state" />
      <select class="rc-select">
        <option>Select an option</option>
        <option>Postgres</option>
        <option>DuckDB</option>
      </select>
      <textarea class="rc-textarea" placeholder="Textarea content..."></textarea>
    </div>
  </div>

  <div class="section">
    <h2>Progress Bar</h2>
    <div class="rc-progress">
      <div class="rc-progress__step rc-progress__step--completed">
        <div class="rc-progress__dot">&#10003;</div>
        <span class="rc-progress__label">Product</span>
      </div>
      <div class="rc-progress__step rc-progress__step--completed">
        <div class="rc-progress__dot">&#10003;</div>
        <span class="rc-progress__label">Owner</span>
      </div>
      <div class="rc-progress__step rc-progress__step--active">
        <div class="rc-progress__dot">3</div>
        <span class="rc-progress__label">Context</span>
      </div>
      <div class="rc-progress__step">
        <div class="rc-progress__dot">4</div>
        <span class="rc-progress__label">Review</span>
      </div>
      <div class="rc-progress__step">
        <div class="rc-progress__dot">5</div>
        <span class="rc-progress__label">Build</span>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Activity Feed</h2>
    <ul class="rc-activity-feed">
      <li class="rc-activity-feed__item">
        <span class="rc-activity-feed__dot"></span>
        <div>
          <p class="rc-activity-feed__message">Published semantic plane v3</p>
          <p class="rc-activity-feed__meta">eric.kittelson &middot; Today</p>
        </div>
      </li>
      <li class="rc-activity-feed__item">
        <span class="rc-activity-feed__dot"></span>
        <div>
          <p class="rc-activity-feed__message">Added 3 golden queries to orders model</p>
          <p class="rc-activity-feed__meta">Yesterday</p>
        </div>
      </li>
    </ul>
  </div>

  <div class="section">
    <h2>Code Block</h2>
    <pre class="rc-code"><code>SELECT customer_id, SUM(total_amount)
FROM orders
WHERE status = 'completed'
GROUP BY customer_id
ORDER BY SUM(total_amount) DESC
LIMIT 10;</code></pre>
  </div>

  <div class="section">
    <h2>Empty State</h2>
    <div class="rc-empty">
      <p class="rc-empty__message">No data products found. Run context setup to build your first one.</p>
      <button class="rc-btn rc-btn--primary rc-btn--sm">Get Started</button>
    </div>
  </div>

  <div class="section">
    <h2>Error Card</h2>
    <div class="rc-error-card">
      <p class="rc-error-card__message">Connection failed: password authentication failed for user 'neondb_owner'</p>
      <button class="rc-btn rc-btn--secondary rc-btn--sm">Retry</button>
    </div>
  </div>

  <div class="section">
    <h2>Spinner</h2>
    <div class="row">
      <span class="rc-spinner"></span>
      <span class="rc-text-sm rc-text-muted">Loading...</span>
    </div>
  </div>

  <div class="section">
    <h2>Color Palette</h2>
    <div class="row">
      <div><div class="swatch" style="background: var(--rc-color-brand-gold);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Gold</p></div>
      <div><div class="swatch" style="background: var(--rc-color-brand-gold-light);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Gold Light</p></div>
      <div><div class="swatch" style="background: var(--rc-color-surface-bg);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">BG</p></div>
      <div><div class="swatch" style="background: var(--rc-color-surface-card);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Card</p></div>
      <div><div class="swatch" style="background: var(--rc-color-tier-gold);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Tier Gold</p></div>
      <div><div class="swatch" style="background: var(--rc-color-tier-silver);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Tier Silver</p></div>
      <div><div class="swatch" style="background: var(--rc-color-tier-bronze);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Tier Bronze</p></div>
      <div><div class="swatch" style="background: var(--rc-color-status-success);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Success</p></div>
      <div><div class="swatch" style="background: var(--rc-color-status-error);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Error</p></div>
      <div><div class="swatch" style="background: var(--rc-color-status-info);"></div><p class="rc-text-xs rc-text-muted" style="margin-top:4px;">Info</p></div>
    </div>
  </div>
</body>
</html>
```

**Step 2: Test it**

```bash
pnpm build
open dev.html
```

Expected: All components render correctly with the gold/dark theme.

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add dev.html component preview page"
```

---

### Task 7: Wire into runcontext-app (Cloud Dashboard)

**Repo:** `/Users/erickittelson/Code/RunContext/runcontext-app`

**Files:**
- Modify: `package.json` — add `@runcontext/uxd` dependency
- Modify: `src/app/globals.css` — replace inline tokens with uxd import
- Modify: `src/components/sidebar.tsx` — import from `@runcontext/uxd/react`
- Modify: `src/components/stat-card.tsx` — import from `@runcontext/uxd/react`
- Modify: `src/components/activity-feed.tsx` — import from `@runcontext/uxd/react`

**Step 1: Install the uxd package (local link)**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext-app
pnpm add ../runcontext-uxd
```

**Step 2: Update globals.css**

Replace the inline `@theme` tokens with the uxd preset. The `@theme inline` block should reference the same values from the uxd package. Since Tailwind 4 uses CSS-based config, import the tokens CSS:

```css
/* src/app/globals.css */
@import "tailwindcss";
@import "@runcontext/uxd/css/tokens";

@theme inline {
  --color-brand-gold: var(--rc-color-brand-gold);
  --color-brand-gold-light: var(--rc-color-brand-gold-light);
  --color-brand-gold-dim: var(--rc-color-brand-gold-dim);

  --color-surface-bg: var(--rc-color-surface-bg);
  --color-surface-card: var(--rc-color-surface-card);
  --color-surface-card-hover: var(--rc-color-surface-card-hover);
  --color-surface-border: var(--rc-color-surface-border-default);
  --color-surface-border-hover: var(--rc-color-surface-border-hover);

  --color-text-primary: var(--rc-color-text-primary);
  --color-text-secondary: var(--rc-color-text-secondary);
  --color-text-muted: var(--rc-color-text-muted);

  --font-sans: var(--rc-font-sans);
  --font-mono: var(--rc-font-mono);
}

body {
  background-color: var(--color-surface-bg);
  color: var(--color-text-primary);
  font-family: var(--font-sans);
}
```

**Step 3: Update components to re-export from uxd**

Replace `src/components/stat-card.tsx`:

```tsx
// src/components/stat-card.tsx
"use client";
export { StatCard } from "@runcontext/uxd/react";
export type { StatCardProps } from "@runcontext/uxd/react";
```

Replace `src/components/activity-feed.tsx`:

```tsx
// src/components/activity-feed.tsx
"use client";
export { ActivityFeed } from "@runcontext/uxd/react";
export type { ActivityFeedProps, ActivityEvent } from "@runcontext/uxd/react";
```

Note: `sidebar.tsx` and `topbar.tsx` have app-specific logic (Clerk auth, Next.js routing, nav items) so they keep their own implementation but can use uxd utility classes and import shared sub-components (Badge, Button) from uxd.

**Step 4: Verify build**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext-app
pnpm build
```

Expected: Build succeeds with no changes to visual output.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire @runcontext/uxd tokens and components into cloud dashboard"
```

---

### Task 8: Wire into runcontext CLI (token colors)

**Repo:** `/Users/erickittelson/Code/RunContext/runcontext` (monorepo)

**Files:**
- Modify: `packages/cli/package.json` — add `@runcontext/uxd` dependency
- Modify: `packages/cli/src/brand.ts` — import tier labels from uxd
- Modify: `packages/cli/src/formatters/pretty.ts` — import hex colors from uxd tokens

**Step 1: Install**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext
pnpm add -w @runcontext/uxd --filter @runcontext/cli
```

Or link locally:

```bash
cd /Users/erickittelson/Code/RunContext/runcontext/packages/cli
pnpm add ../../runcontext-uxd
```

**Step 2: Read the existing pretty.ts formatter to identify hardcoded hex values**

Check `packages/cli/src/formatters/pretty.ts` for `chalk.hex(...)` calls and replace with:

```typescript
import { colors } from '@runcontext/uxd';

// Replace: chalk.hex('#CD7F32') → chalk.hex(colors.tier.bronze)
// Replace: chalk.yellow → chalk.hex(colors.tier.gold)
// Replace: chalk.red → chalk.hex(colors.status.error)
// etc.
```

**Step 3: Verify build**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext
pnpm build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: use @runcontext/uxd tokens in CLI formatters"
```

---

### Task 9: Wire into wizard (packages/ui)

**Repo:** `/Users/erickittelson/Code/RunContext/runcontext` (monorepo)

**Files:**
- Modify: `packages/ui/package.json` — add `@runcontext/uxd` dependency
- Modify: `packages/ui/static/setup.css` — replace custom CSS variables and component styles with uxd imports
- Modify: `packages/ui/src/server.ts` — add uxd CSS link to HTML template

This is the largest migration — `setup.css` has 500+ lines of hand-rolled styles. The approach:
1. Add a `<link>` to the uxd CSS in the HTML template
2. Replace `:root` variables with uxd token variables
3. Replace component classes (`.source-card` → `.rc-card`, buttons → `.rc-btn`, etc.)
4. Keep wizard-specific layout CSS (`.wizard`, `.progress-bar` positioning, `.step` visibility)
5. Delete redundant style rules

**Step 1: Update server.ts HTML template**

In the `setupPageHTML()` function, add before the existing stylesheet link:

```html
<link rel="stylesheet" href="/static/uxd.css" />
```

**Step 2: Copy the built uxd CSS into static**

Add a build step or copy script:

```bash
cp /Users/erickittelson/Code/RunContext/runcontext-uxd/dist/css/index.css packages/ui/static/uxd.css
```

Or serve it from node_modules at runtime. The simplest approach for now is to copy it.

**Step 3: Update setup.css**

Replace the `:root` block to reference uxd variables:

```css
:root {
  /* Map wizard variables to uxd tokens */
  --bg: var(--rc-color-surface-bg);
  --surface: var(--rc-color-surface-card);
  --surface-hover: var(--rc-color-surface-card-hover);
  --border: var(--rc-color-border-default);
  --border-focus: var(--rc-color-brand-gold);
  --text: var(--rc-color-text-primary);
  --text-muted: var(--rc-color-text-muted);
  --accent: var(--rc-color-brand-gold);
  --accent-hover: var(--rc-color-brand-gold-light);
  --success: var(--rc-color-status-success);
  --error: var(--rc-color-status-error);
  --warning: var(--rc-color-status-warning);
  --font: var(--rc-font-sans);
  --radius: var(--rc-radius-md);
  --radius-sm: var(--rc-radius-sm);
  --shadow: var(--rc-shadow-md);
}
```

This preserves all existing class selectors while routing through uxd tokens. A full class migration (`.source-card` → `.rc-card`) can happen in a follow-up.

**Step 4: Verify**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext
pnpm build
node packages/cli/dist/index.js setup --no-browser --port 4041
```

Open http://127.0.0.1:4041/setup and verify the wizard looks correct with uxd tokens.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire @runcontext/uxd tokens into wizard UI"
```

---

### Task 10: Wire into data catalog (packages/site)

**Repo:** `/Users/erickittelson/Code/RunContext/runcontext` (monorepo)

**Files:**
- Modify: `packages/site/astro/src/layouts/Base.astro` — replace inline `:root` variables with uxd token imports

**Step 1: Copy uxd CSS into the Astro public directory**

```bash
cp /Users/erickittelson/Code/RunContext/runcontext-uxd/dist/css/tokens.css packages/site/astro/public/uxd-tokens.css
```

**Step 2: Add link in Base.astro `<head>`**

```html
<link rel="stylesheet" href="/uxd-tokens.css" />
```

**Step 3: Update the `<style is:global>` block**

Replace the hardcoded color values with uxd CSS variable references:

```css
:root {
  --bg: var(--rc-color-surface-bg);
  --accent: var(--rc-color-brand-gold);
  --accent-dim: var(--rc-color-brand-gold-dim);
  --text: var(--rc-color-text-primary);
  --text-muted: var(--rc-color-text-muted);
  --border: var(--rc-color-border-default);
  /* ... map remaining variables */
}
```

**Step 4: Verify**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext
pnpm build
node packages/cli/dist/index.js site --open
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire @runcontext/uxd tokens into data catalog site"
```

---

### Task 11: Wire into docs site (runcontext-site)

**Repo:** `/Users/erickittelson/Code/RunContext/runcontext-site`

**Files:**
- Modify: `src/styles/custom.css` — replace hardcoded Starlight variable overrides with uxd tokens

**Step 1: Install uxd**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext-site
pnpm add ../runcontext-uxd
```

**Step 2: Import tokens in custom.css**

Add at top of `src/styles/custom.css`:

```css
@import "@runcontext/uxd/css/tokens";
```

**Step 3: Replace hardcoded values**

```css
:root {
  --sl-color-accent: var(--rc-color-brand-gold);
  --sl-color-accent-low: var(--rc-color-brand-gold-dim);
  --sl-color-accent-high: var(--rc-color-brand-gold-light);
  /* ... remaining Starlight overrides */
}
```

**Step 4: Verify**

```bash
pnpm build
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire @runcontext/uxd tokens into docs site"
```

---

### Task 12: Wire into cloud studio (runcontext-cloud)

**Repo:** `/Users/erickittelson/Code/RunContext/runcontext-cloud`

**Files:**
- Modify: `src/routes/studio.ts` — replace inline CSS variables with uxd token values

Since the cloud studio renders HTML strings with inline `<style>` blocks on Cloudflare Workers, it can't import CSS files at runtime. Instead, import the token JS values:

**Step 1: Install uxd**

```bash
cd /Users/erickittelson/Code/RunContext/runcontext-cloud
pnpm add ../runcontext-uxd
```

**Step 2: Update studio.ts**

```typescript
import { colors, typography, radii, shadows } from '@runcontext/uxd';

// Replace hardcoded values in the inline <style> block:
// --bg: #0a0a0f → --bg: ${colors.surface.bg}
// --accent: #4f9eff → --accent: ${colors.brand.gold}
// etc.
```

**Step 3: Verify**

```bash
pnpm build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: wire @runcontext/uxd tokens into cloud studio"
```
