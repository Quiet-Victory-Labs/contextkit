# RunContext UXD System Design

**Date:** 2026-03-09
**Status:** Approved

## Problem

RunContext has 6 UI surfaces across 4 repos, all sharing the same gold/dark brand but with zero shared code. Colors, buttons, cards, nav patterns, and typography are copy-pasted with slight variations. This creates visual inconsistency, duplicated maintenance, and slows new surface development.

### Current Surfaces

| Surface | Repo | Stack | Styling |
|---------|------|-------|---------|
| Cloud Dashboard | `runcontext-app` | Next.js 16 + React 19 + Tailwind 4 | `globals.css` tokens |
| Cloud API Studio | `runcontext-cloud` | Hono on CF Workers | Inline CSS in HTML |
| CLI Wizard | `runcontext/packages/ui` | Hono + vanilla JS | `setup.css` |
| Data Catalog | `runcontext/packages/site` | Astro | Inline `<style>` |
| Docs Site | `runcontext-site` | Astro + Starlight | `custom.css` |
| CLI | `runcontext/packages/cli` | Chalk | Hardcoded hex |

## Solution

A standalone `@runcontext/uxd` package (`runcontext-uxd` repo) providing design tokens, CSS component classes, a Tailwind preset, and React components.

## Package Structure

```
@runcontext/uxd
├── tokens/           # Design tokens (single source of truth)
│   ├── colors.ts
│   ├── typography.ts
│   ├── spacing.ts
│   ├── radii.ts
│   └── shadows.ts
│
├── css/              # Generated CSS variables + component classes
│   ├── tokens.css       :root variables
│   ├── components.css   .rc-btn, .rc-card, .rc-input, .rc-badge, .rc-nav, ...
│   └── utilities.css    .rc-text-muted, .rc-tier-gold, ...
│
├── tailwind/         # Tailwind preset (for runcontext-app)
│   └── preset.ts
│
└── react/            # React components (for runcontext-app)
    ├── Button.tsx
    ├── Card.tsx
    ├── StatCard.tsx
    ├── Sidebar.tsx
    ├── TopBar.tsx
    ├── Badge.tsx
    ├── TierBadge.tsx
    ├── Input.tsx
    └── ActivityFeed.tsx
```

### Consumer Matrix

| Consumer | Imports |
|----------|---------|
| `runcontext-app` (Next.js) | `@runcontext/uxd/tailwind` preset + `@runcontext/uxd/react` components |
| `runcontext/packages/ui` (wizard) | `@runcontext/uxd/css` (tokens + components) |
| `runcontext/packages/site` (catalog) | `@runcontext/uxd/css` (tokens + components) |
| `runcontext-site` (docs) | `@runcontext/uxd/css/tokens` (tokens only) |
| `runcontext-cloud` (studio) | `@runcontext/uxd/css` (tokens + components) |
| `runcontext/packages/cli` | `@runcontext/uxd/tokens` (JS import for hex values) |

## Design Tokens

### Colors

```
Brand:
  gold:        #c9a55a
  gold-light:  #f5e6c0
  gold-dim:    #1a1508

Surfaces:
  bg:          #0a0908
  card:        #121110
  card-hover:  #1e1c18

Borders:
  default:     #36342e
  hover:       #6a675e

Text:
  primary:     #e8e6e1
  secondary:   #9a978e
  muted:       #6a675e

Tiers:
  gold:        #c9a55a
  silver:      #a0a8b8
  bronze:      #b87a4a

Status:
  success:     #22c55e
  error:       #ef4444
  warning:     #eab308
  info:        #4f9eff
```

### Typography

```
Sans:  "Plus Jakarta Sans", system-ui, -apple-system, sans-serif
Mono:  "Geist Mono", "SF Mono", Consolas, monospace

Scale:
  xs:    0.75rem
  sm:    0.875rem
  base:  1rem
  lg:    1.125rem
  xl:    1.25rem
  2xl:   1.5rem
  3xl:   2rem
```

### Spacing (4px base grid)

4, 8, 12, 16, 20, 24, 32, 40, 48, 64

### Border Radii

```
sm:   4px
md:   8px
lg:   12px
full: 9999px
```

### Shadows

```
sm:  0 1px 2px rgba(0, 0, 0, 0.3)
md:  0 2px 8px rgba(0, 0, 0, 0.4)
lg:  0 4px 16px rgba(0, 0, 0, 0.5)
```

## Components

### Core (all surfaces)

- **Button** — primary (gold), secondary (outline), ghost, danger. Sizes: sm/md/lg
- **Card** — surface background, border, hover state. Variants: default, interactive, stat
- **Badge** — tier (gold/silver/bronze), status (success/error/warning/info)
- **Input / Select / Textarea** — form controls with gold focus ring

### Navigation

- **Sidebar** — fixed left nav with logo, nav items, external links
- **TopBar** — fixed top bar with breadcrumb/title and right-side actions
- **ProgressBar** — stepped progress indicator

### Data Display

- **StatCard** — icon + label + value
- **TierBadge** — tier color + label (Discoverable/Trusted/AI-Ready)
- **ActivityFeed** — timeline with icons and timestamps
- **CodeBlock** — SQL/YAML with syntax highlighting

### Feedback

- **EmptyState** — icon + message + action
- **LoadingSpinner** — consistent loading indicator
- **ErrorCard** — error display with retry

### Implementation Pattern

React components are thin wrappers around CSS classes. Both React and non-React surfaces use the same visual styling:

```tsx
// React: <Button variant="primary" size="md">Save</Button>
// HTML:  <button class="rc-btn rc-btn--primary rc-btn--md">Save</button>
```

## Build & Distribution

- **Build tool:** tsup (consistent with other RunContext packages)
- **Tokens → CSS:** Build step generates CSS variables from TypeScript token definitions
- **No Storybook:** Simple `dev.html` preview page for all component variants
- **Package name:** `@runcontext/uxd`

### Exports Map

```json
{
  ".":            "./dist/tokens/index.js",
  "./css":        "./dist/css/index.css",
  "./css/tokens": "./dist/css/tokens.css",
  "./tailwind":   "./dist/tailwind/preset.js",
  "./react":      "./dist/react/index.js"
}
```

## Design Decisions

1. **Gold as universal brand accent** — The wizard's blue (#4f9eff) becomes info/interactive-only. Brand accent is gold (#c9a55a) everywhere.
2. **Dark mode only** — All surfaces are dark. Docs site keeps Starlight's built-in light mode.
3. **CSS-first, React-second** — Visual styling lives in CSS classes so any surface can use it. React components wrap the same classes.
4. **No runtime CSS-in-JS** — All CSS is generated at build time.
5. **Standalone repo** — Serves 4 repos; embedding in any one creates awkward cross-repo deps.

## Migration Path

1. Build the package
2. Wire into `runcontext-app` first (biggest surface, replaces `globals.css` + inline components)
3. Then wizard, catalog, docs, cloud studio, CLI — one at a time
4. Each migration deletes old inline styles and imports from `@runcontext/uxd`
