# ContextKit v0.1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the complete ContextKit v0.1 — a Git-native compiler, linter, autofix, site generator, and MCP server for institutional context.

**Architecture:** Multi-phase compiler pipeline (discover → parse → validate → normalize → resolve → lint → emit) with typed ContextGraph IR. Monorepo with 4 packages: core, cli, site, mcp. TDD throughout.

**Tech Stack:** TypeScript, pnpm workspaces, tsup, Commander.js, Zod, Vitest, EJS, Tailwind CSS, MiniSearch, @modelcontextprotocol/sdk, chokidar

---

### Task 1: Initialize Monorepo Scaffold

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `packages/core/package.json`
- Create: `packages/core/tsconfig.json`
- Create: `packages/core/tsup.config.ts`
- Create: `packages/core/src/index.ts`
- Create: `packages/cli/package.json`
- Create: `packages/cli/tsconfig.json`
- Create: `packages/cli/tsup.config.ts`
- Create: `packages/cli/src/index.ts`
- Create: `packages/site/package.json`
- Create: `packages/site/tsconfig.json`
- Create: `packages/site/tsup.config.ts`
- Create: `packages/site/src/index.ts`
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/tsup.config.ts`
- Create: `packages/mcp/src/index.ts`

**Step 1: Create root package.json**

```json
{
  "name": "contextkit",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "vitest",
    "typecheck": "tsc -b",
    "clean": "pnpm -r run clean"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vitest": "^3.2.0"
  }
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - 'packages/*'
  - 'create-contextkit'
```

**Step 3: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "target": "es2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

**Step 4: Create root tsconfig.json (project references)**

```json
{
  "files": [],
  "references": [
    { "path": "packages/core" },
    { "path": "packages/cli" },
    { "path": "packages/site" },
    { "path": "packages/mcp" }
  ]
}
```

**Step 5: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: ['packages/*'],
  },
})
```

**Step 6: Create .gitignore**

```
node_modules/
dist/
.contextkit-cache/
*.tsbuildinfo
.DS_Store
```

**Step 7: Create packages/core/package.json**

```json
{
  "name": "@contextkit/core",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "yaml": "^2.7.0",
    "zod": "^3.24.0",
    "glob": "^11.0.0"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.0"
  }
}
```

**Step 8: Create packages/core/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

**Step 9: Create packages/core/tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' }
  },
})
```

**Step 10: Create packages/core/src/index.ts (placeholder)**

```typescript
export const VERSION = '0.1.0';
```

**Step 11: Create packages/cli/package.json**

```json
{
  "name": "@contextkit/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "context": "./dist/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@contextkit/core": "workspace:*",
    "@contextkit/site": "workspace:*",
    "@contextkit/mcp": "workspace:*",
    "commander": "^14.0.0",
    "chokidar": "^4.0.0",
    "chalk": "^5.4.0"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.0"
  }
}
```

**Step 12: Create packages/cli/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [
    { "path": "../core" },
    { "path": "../site" },
    { "path": "../mcp" }
  ]
}
```

**Step 13: Create packages/cli/tsup.config.ts**

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
  shims: true,
})
```

**Step 14: Create packages/cli/src/index.ts (placeholder)**

```typescript
console.log('contextkit cli');
```

**Step 15: Create packages/site/package.json**

```json
{
  "name": "@contextkit/site",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@contextkit/core": "workspace:*",
    "ejs": "^3.1.10",
    "minisearch": "^7.1.0"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.0",
    "@types/ejs": "^3.1.5"
  }
}
```

**Step 16: Create packages/site (tsconfig + tsup + placeholder)**

`packages/site/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

`packages/site/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' }
  },
})
```

`packages/site/src/index.ts`:
```typescript
export const SITE_VERSION = '0.1.0';
```

**Step 17: Create packages/mcp/package.json**

```json
{
  "name": "@contextkit/mcp",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.cjs",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "@contextkit/core": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.12.0",
    "zod": "^3.24.0",
    "express": "^5.1.0"
  },
  "devDependencies": {
    "tsup": "^8.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.0",
    "@types/express": "^5.0.0"
  }
}
```

`packages/mcp/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "references": [{ "path": "../core" }]
}
```

`packages/mcp/tsup.config.ts`:
```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outExtension({ format }) {
    return { js: format === 'esm' ? '.mjs' : '.cjs' }
  },
})
```

`packages/mcp/src/index.ts`:
```typescript
export const MCP_VERSION = '0.1.0';
```

**Step 18: Install dependencies and verify build**

Run: `pnpm install && pnpm build`
Expected: All 4 packages build successfully, dist/ dirs created.

**Step 19: Commit**

```bash
git add -A
git commit -m "feat: initialize monorepo scaffold with core, cli, site, mcp packages"
```

---

### Task 2: Core Types

**Files:**
- Create: `packages/core/src/types/index.ts`
- Create: `packages/core/src/types/nodes.ts`
- Create: `packages/core/src/types/config.ts`
- Create: `packages/core/src/types/diagnostics.ts`
- Create: `packages/core/src/types/manifest.ts`
- Test: `packages/core/src/types/__tests__/types.test.ts`

**Step 1: Write the failing test**

`packages/core/src/types/__tests__/types.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import type {
  NodeKind,
  BaseNode,
  Concept,
  Product,
  Policy,
  Entity,
  Term,
  Owner,
  SourceLocation,
  Diagnostic,
  Fix,
  TextEdit,
  ContextKitConfig,
  Manifest,
} from '../index.js';

describe('Core Types', () => {
  it('should allow creating a valid Concept node', () => {
    const concept: Concept = {
      id: 'gross-revenue',
      kind: 'concept',
      source: { file: 'context/concepts/gross_revenue.ctx.yaml', line: 1, col: 1 },
      owner: 'finance-team',
      tags: ['finance', 'certified'],
      status: 'certified',
      definition: 'Total invoiced revenue before refunds.',
      certified: true,
      evidence: [{ type: 'decision', ref: 'context://evidence/decisions/2026-03-revenue' }],
      dependsOn: [],
      examples: [{ label: 'Correct usage', content: 'SUM(invoice_amount)', kind: 'do' }],
    };
    expect(concept.kind).toBe('concept');
    expect(concept.certified).toBe(true);
  });

  it('should allow creating a valid Product node', () => {
    const product: Product = {
      id: 'revenue-reporting',
      kind: 'product',
      source: { file: 'context/products/revenue.ctx.yaml', line: 1, col: 1 },
      owner: 'finance-team',
      description: 'Official revenue reporting.',
      tags: ['finance'],
    };
    expect(product.kind).toBe('product');
  });

  it('should allow creating a valid Policy node', () => {
    const policy: Policy = {
      id: 'pii-access',
      kind: 'policy',
      source: { file: 'context/policies/pii.policy.yaml', line: 1, col: 1 },
      description: 'PII requires elevated role.',
      rules: [
        {
          priority: 100,
          when: { tagsAny: ['pii'] },
          then: { requireRole: 'data_admin' },
        },
      ],
    };
    expect(policy.rules).toHaveLength(1);
  });

  it('should allow creating a Diagnostic', () => {
    const diag: Diagnostic = {
      ruleId: 'ownership/required',
      severity: 'error',
      message: 'Missing required field: owner',
      source: { file: 'test.yaml', line: 2, col: 1 },
      fixable: true,
      fix: {
        description: 'Add owner stub',
        edits: [{ file: 'test.yaml', range: { startLine: 2, startCol: 1, endLine: 2, endCol: 1 }, newText: 'owner: TODO\n' }],
      },
    };
    expect(diag.fixable).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/types/__tests__/types.test.ts`
Expected: FAIL — modules not found

**Step 3: Write the types**

`packages/core/src/types/nodes.ts`:
```typescript
export type NodeKind = 'concept' | 'entity' | 'policy' | 'term' | 'owner' | 'product';
export type Status = 'draft' | 'certified' | 'deprecated';
export type Severity = 'error' | 'warning';

export interface SourceLocation {
  file: string;
  line: number;
  col: number;
}

export interface Evidence {
  type: string;
  ref: string;
}

export interface Example {
  label: string;
  content: string;
  kind: 'do' | 'dont';
}

export interface BaseNode {
  id: string;
  kind: NodeKind;
  source: SourceLocation;
  owner?: string;
  tags?: string[];
  status?: Status;
  description?: string;
}

export interface Concept extends BaseNode {
  kind: 'concept';
  productId?: string;
  definition: string;
  certified?: boolean;
  evidence?: Evidence[];
  dependsOn?: string[];
  examples?: Example[];
}

export interface Product extends BaseNode {
  kind: 'product';
  description: string;
}

export interface Entity extends BaseNode {
  kind: 'entity';
  definition?: string;
  fields?: EntityField[];
}

export interface EntityField {
  name: string;
  description?: string;
  type?: string;
}

export interface PolicyRule {
  priority: number;
  when: { tagsAny?: string[]; conceptIds?: string[]; status?: Status };
  then: { requireRole?: string; deny?: boolean; warn?: string };
}

export interface Policy extends BaseNode {
  kind: 'policy';
  description: string;
  rules: PolicyRule[];
}

export interface Term extends BaseNode {
  kind: 'term';
  definition: string;
  synonyms?: string[];
  mapsTo?: string[];
}

export interface Owner extends BaseNode {
  kind: 'owner';
  displayName: string;
  email?: string;
  team?: string;
}

export type ContextNode = Concept | Product | Entity | Policy | Term | Owner;

export interface Edge {
  from: string;
  to: string;
  type: 'depends_on' | 'relates_to' | 'applies_to' | 'maps_to' | 'owned_by' | 'belongs_to';
}

export interface ContextGraph {
  nodes: Map<string, ContextNode>;
  edges: Edge[];
  indexes: {
    byKind: Map<NodeKind, string[]>;
    byOwner: Map<string, string[]>;
    byTag: Map<string, string[]>;
    byStatus: Map<string, string[]>;
    dependents: Map<string, string[]>;
  };
}
```

`packages/core/src/types/diagnostics.ts`:
```typescript
import type { Severity, SourceLocation } from './nodes.js';

export interface TextEdit {
  file: string;
  range: { startLine: number; startCol: number; endLine: number; endCol: number };
  newText: string;
}

export interface Fix {
  description: string;
  edits: TextEdit[];
}

export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  source: SourceLocation;
  fixable: boolean;
  fix?: Fix;
  suggestions?: string[];
}
```

`packages/core/src/types/config.ts`:
```typescript
import type { Severity } from './nodes.js';

export interface ProjectConfig {
  id: string;
  displayName: string;
  version: string;
}

export interface PathsConfig {
  rootDir?: string;
  contextDir?: string;
  distDir?: string;
  cacheDir?: string;
}

export interface SiteConfig {
  enabled?: boolean;
  title?: string;
  basePath?: string;
}

export interface McpConfig {
  enabled?: boolean;
  transport?: ('stdio' | 'http')[];
  http?: { port?: number; host?: string };
}

export interface LintConfig {
  defaultSeverity?: Severity;
  rules?: Record<string, Severity | 'off'>;
}

export interface ContextKitConfig {
  project: ProjectConfig;
  paths?: PathsConfig;
  site?: SiteConfig;
  mcp?: McpConfig;
  lint?: LintConfig;
  plugins?: unknown[];
}
```

`packages/core/src/types/manifest.ts`:
```typescript
export interface ManifestBuild {
  timestamp: string;
  git?: { commit: string; dirty: boolean };
}

export interface ManifestProject {
  id: string;
  displayName: string;
  version: string;
  build: ManifestBuild;
}

export interface ManifestConcept {
  id: string;
  productId?: string;
  owner?: string;
  definition: string;
  certified?: boolean;
  evidence?: { type: string; ref: string }[];
  dependsOn?: string[];
  tags?: string[];
  status?: string;
  examples?: { label: string; content: string; kind: string }[];
}

export interface ManifestProduct {
  id: string;
  owner?: string;
  description: string;
  tags?: string[];
}

export interface ManifestPolicy {
  id: string;
  description: string;
  rules: { priority: number; when: Record<string, unknown>; then: Record<string, unknown> }[];
}

export interface ManifestEntity {
  id: string;
  owner?: string;
  definition?: string;
  tags?: string[];
}

export interface ManifestTerm {
  id: string;
  definition: string;
  synonyms?: string[];
  mapsTo?: string[];
}

export interface ManifestOwner {
  id: string;
  displayName: string;
  email?: string;
  team?: string;
}

export interface Manifest {
  schemaVersion: string;
  project: ManifestProject;
  products: ManifestProduct[];
  concepts: ManifestConcept[];
  policies: ManifestPolicy[];
  entities: ManifestEntity[];
  terms: ManifestTerm[];
  owners: ManifestOwner[];
  indexes: { byId: Record<string, string> };
}
```

`packages/core/src/types/index.ts`:
```typescript
export * from './nodes.js';
export * from './diagnostics.js';
export * from './config.js';
export * from './manifest.js';
```

**Step 4: Update packages/core/src/index.ts to re-export types**

```typescript
export * from './types/index.js';
```

**Step 5: Run test to verify it passes**

Run: `cd packages/core && npx vitest run src/types/__tests__/types.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/types packages/core/src/index.ts
git commit -m "feat(core): add type definitions for nodes, diagnostics, config, manifest"
```

---

### Task 3: Zod Schemas for Context File Validation

**Files:**
- Create: `packages/core/src/schema/index.ts`
- Create: `packages/core/src/schema/concept.ts`
- Create: `packages/core/src/schema/product.ts`
- Create: `packages/core/src/schema/policy.ts`
- Create: `packages/core/src/schema/entity.ts`
- Create: `packages/core/src/schema/term.ts`
- Create: `packages/core/src/schema/owner.ts`
- Test: `packages/core/src/schema/__tests__/schema.test.ts`

**Step 1: Write the failing test**

`packages/core/src/schema/__tests__/schema.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import {
  conceptFileSchema,
  productFileSchema,
  policyFileSchema,
  entityFileSchema,
  termFileSchema,
  ownerFileSchema,
} from '../index.js';

describe('Concept schema', () => {
  it('validates a complete concept file', () => {
    const input = {
      id: 'gross-revenue',
      name: 'Gross Revenue',
      domain: 'finance',
      definition: 'Total invoiced revenue before refunds.',
      owner: 'finance-team',
      status: 'certified',
      certified: true,
      tags: ['finance', 'metric'],
      evidence: [{ type: 'decision', ref: 'context://evidence/decisions/2026-03-revenue' }],
      depends_on: ['invoice-total'],
      examples: [
        { label: 'Correct', content: 'SUM(invoice_amount)', kind: 'do' },
        { label: 'Wrong', content: 'SUM(payment_amount)', kind: 'dont' },
      ],
    };
    const result = conceptFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('rejects concept missing definition', () => {
    const input = { id: 'test', owner: 'team' };
    const result = conceptFileSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});

describe('Product schema', () => {
  it('validates a complete product file', () => {
    const input = {
      id: 'revenue-reporting',
      name: 'Revenue Reporting',
      description: 'Official revenue dataset.',
      owner: 'finance-team',
      tags: ['finance'],
    };
    const result = productFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('Policy schema', () => {
  it('validates a policy with rules', () => {
    const input = {
      id: 'pii-access',
      description: 'PII requires elevated role.',
      rules: [
        { priority: 100, when: { tags_any: ['pii'] }, then: { require_role: 'data_admin' } },
      ],
    };
    const result = policyFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});

describe('Owner schema', () => {
  it('validates an owner file', () => {
    const input = {
      id: 'finance-team',
      display_name: 'Finance Team',
      email: 'finance@acme.com',
      team: 'Finance',
    };
    const result = ownerFileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/schema/__tests__/schema.test.ts`
Expected: FAIL — modules not found

**Step 3: Implement schemas**

`packages/core/src/schema/concept.ts`:
```typescript
import { z } from 'zod';

export const evidenceSchema = z.object({
  type: z.string(),
  ref: z.string(),
});

export const exampleSchema = z.object({
  label: z.string(),
  content: z.string(),
  kind: z.enum(['do', 'dont']),
});

export const conceptFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  domain: z.string().optional(),
  product_id: z.string().optional(),
  definition: z.string(),
  owner: z.string().optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
  certified: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  evidence: z.array(evidenceSchema).optional(),
  depends_on: z.array(z.string()).optional(),
  examples: z.array(exampleSchema).optional(),
  description: z.string().optional(),
});
```

`packages/core/src/schema/product.ts`:
```typescript
import { z } from 'zod';

export const productFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  description: z.string(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
});
```

`packages/core/src/schema/policy.ts`:
```typescript
import { z } from 'zod';

const policyWhenSchema = z.object({
  tags_any: z.array(z.string()).optional(),
  concept_ids: z.array(z.string()).optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
}).passthrough();

const policyThenSchema = z.object({
  require_role: z.string().optional(),
  deny: z.boolean().optional(),
  warn: z.string().optional(),
}).passthrough();

const policyRuleSchema = z.object({
  priority: z.number(),
  when: policyWhenSchema,
  then: policyThenSchema,
});

export const policyFileSchema = z.object({
  id: z.string(),
  description: z.string(),
  rules: z.array(policyRuleSchema),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
```

`packages/core/src/schema/entity.ts`:
```typescript
import { z } from 'zod';

const entityFieldSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  type: z.string().optional(),
});

export const entityFileSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  definition: z.string().optional(),
  description: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'certified', 'deprecated']).optional(),
  fields: z.array(entityFieldSchema).optional(),
});
```

`packages/core/src/schema/term.ts`:
```typescript
import { z } from 'zod';

export const termFileSchema = z.object({
  id: z.string(),
  term: z.string().optional(),
  definition: z.string(),
  synonyms: z.array(z.string()).optional(),
  maps_to: z.array(z.string()).optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
```

`packages/core/src/schema/owner.ts`:
```typescript
import { z } from 'zod';

export const ownerFileSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  email: z.string().optional(),
  team: z.string().optional(),
  tags: z.array(z.string()).optional(),
});
```

`packages/core/src/schema/index.ts`:
```typescript
export { conceptFileSchema, evidenceSchema, exampleSchema } from './concept.js';
export { productFileSchema } from './product.js';
export { policyFileSchema } from './policy.js';
export { entityFileSchema } from './entity.js';
export { termFileSchema } from './term.js';
export { ownerFileSchema } from './owner.js';
```

Update `packages/core/src/index.ts`:
```typescript
export * from './types/index.js';
export * from './schema/index.js';
```

**Step 4: Run tests**

Run: `cd packages/core && npx vitest run src/schema/__tests__/schema.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/schema packages/core/src/index.ts
git commit -m "feat(core): add Zod schemas for context file validation"
```

---

### Task 4: Config Loader

**Files:**
- Create: `packages/core/src/config/loader.ts`
- Create: `packages/core/src/config/index.ts`
- Create: `packages/core/src/config/defaults.ts`
- Test: `packages/core/src/config/__tests__/loader.test.ts`

**Step 1: Write the failing test**

`packages/core/src/config/__tests__/loader.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { loadConfig, resolveConfig, DEFAULT_CONFIG } from '../index.js';
import type { ContextKitConfig } from '../../types/index.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('resolveConfig', () => {
  it('merges partial config with defaults', () => {
    const partial: Partial<ContextKitConfig> = {
      project: { id: 'test', displayName: 'Test', version: '1.0.0' },
    };
    const resolved = resolveConfig(partial);
    expect(resolved.project.id).toBe('test');
    expect(resolved.paths?.contextDir).toBe('./context');
    expect(resolved.paths?.distDir).toBe('./dist');
  });

  it('preserves user overrides', () => {
    const partial: Partial<ContextKitConfig> = {
      project: { id: 'test', displayName: 'Test', version: '1.0.0' },
      paths: { contextDir: './custom-context' },
    };
    const resolved = resolveConfig(partial);
    expect(resolved.paths?.contextDir).toBe('./custom-context');
  });
});

describe('loadConfig', () => {
  const tmpDir = join(tmpdir(), 'contextkit-config-test-' + Date.now());

  it('loads YAML config', async () => {
    const dir = join(tmpDir, 'yaml-test');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'contextkit.config.yaml'), `
project:
  id: yaml-project
  displayName: YAML Project
  version: 0.1.0
`);
    const config = await loadConfig(dir);
    expect(config.project.id).toBe('yaml-project');

    rmSync(dir, { recursive: true });
  });

  it('returns default config when no config file exists', async () => {
    const dir = join(tmpDir, 'no-config');
    mkdirSync(dir, { recursive: true });
    const config = await loadConfig(dir);
    expect(config.project.id).toBe('my-context');

    rmSync(dir, { recursive: true });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/config/__tests__/loader.test.ts`
Expected: FAIL

**Step 3: Implement config loader**

`packages/core/src/config/defaults.ts`:
```typescript
import type { ContextKitConfig } from '../types/index.js';

export const DEFAULT_CONFIG: ContextKitConfig = {
  project: {
    id: 'my-context',
    displayName: 'My Context',
    version: '0.1.0',
  },
  paths: {
    rootDir: '.',
    contextDir: './context',
    distDir: './dist',
    cacheDir: './.contextkit-cache',
  },
  site: {
    enabled: true,
    title: 'Context Site',
    basePath: '/',
  },
  lint: {
    defaultSeverity: 'warning',
    rules: {},
  },
  mcp: {
    enabled: true,
    transport: ['stdio'],
    http: { port: 7331, host: '127.0.0.1' },
  },
  plugins: [],
};
```

`packages/core/src/config/loader.ts`:
```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { DEFAULT_CONFIG } from './defaults.js';
import type { ContextKitConfig } from '../types/index.js';

export function resolveConfig(partial: Partial<ContextKitConfig>): ContextKitConfig {
  return {
    project: partial.project ?? DEFAULT_CONFIG.project,
    paths: { ...DEFAULT_CONFIG.paths, ...partial.paths },
    site: { ...DEFAULT_CONFIG.site, ...partial.site },
    lint: {
      ...DEFAULT_CONFIG.lint,
      ...partial.lint,
      rules: { ...DEFAULT_CONFIG.lint?.rules, ...partial.lint?.rules },
    },
    mcp: { ...DEFAULT_CONFIG.mcp, ...partial.mcp },
    plugins: partial.plugins ?? DEFAULT_CONFIG.plugins ?? [],
  };
}

export async function loadConfig(rootDir: string): Promise<ContextKitConfig> {
  // Try TS config first
  const tsPath = join(rootDir, 'contextkit.config.ts');
  if (existsSync(tsPath)) {
    const mod = await import(tsPath);
    return resolveConfig(mod.default ?? mod);
  }

  // Try JS config
  const jsPath = join(rootDir, 'contextkit.config.js');
  if (existsSync(jsPath)) {
    const mod = await import(jsPath);
    return resolveConfig(mod.default ?? mod);
  }

  // Try YAML config
  const yamlPath = join(rootDir, 'contextkit.config.yaml');
  if (existsSync(yamlPath)) {
    const content = readFileSync(yamlPath, 'utf-8');
    const parsed = parseYaml(content);
    return resolveConfig(parsed);
  }

  // Try YML config
  const ymlPath = join(rootDir, 'contextkit.config.yml');
  if (existsSync(ymlPath)) {
    const content = readFileSync(ymlPath, 'utf-8');
    const parsed = parseYaml(content);
    return resolveConfig(parsed);
  }

  // No config found — use defaults
  return resolveConfig({});
}
```

`packages/core/src/config/index.ts`:
```typescript
export { loadConfig, resolveConfig } from './loader.js';
export { DEFAULT_CONFIG } from './defaults.js';
```

Update `packages/core/src/index.ts`:
```typescript
export * from './types/index.js';
export * from './schema/index.js';
export * from './config/index.js';
```

**Step 4: Run tests**

Run: `cd packages/core && npx vitest run src/config/__tests__/loader.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/core/src/config packages/core/src/index.ts
git commit -m "feat(core): add config loader with YAML/TS support and defaults"
```

---

### Task 5: File Discovery and YAML Parser

**Files:**
- Create: `packages/core/src/parser/discover.ts`
- Create: `packages/core/src/parser/parse.ts`
- Create: `packages/core/src/parser/index.ts`
- Test: `packages/core/src/parser/__tests__/parser.test.ts`
- Create: `fixtures/minimal/context/concepts/gross-revenue.ctx.yaml`
- Create: `fixtures/minimal/context/products/revenue-reporting.ctx.yaml`
- Create: `fixtures/minimal/context/policies/pii-access.policy.yaml`
- Create: `fixtures/minimal/context/owners/finance-team.owner.yaml`
- Create: `fixtures/minimal/contextkit.config.yaml`

**Step 1: Create test fixtures**

`fixtures/minimal/contextkit.config.yaml`:
```yaml
project:
  id: minimal-test
  displayName: Minimal Test
  version: 0.1.0
```

`fixtures/minimal/context/concepts/gross-revenue.ctx.yaml`:
```yaml
id: gross-revenue
definition: Total invoiced revenue before refunds or adjustments.
owner: finance-team
status: certified
certified: true
tags: [finance, metric]
evidence:
  - type: decision
    ref: "context://evidence/decisions/2026-03-revenue"
examples:
  - label: Correct usage
    content: "SUM(invoice_amount)"
    kind: do
  - label: Common mistake
    content: "SUM(payment_amount) -- includes partial payments"
    kind: dont
```

`fixtures/minimal/context/products/revenue-reporting.ctx.yaml`:
```yaml
id: revenue-reporting
description: Official revenue reporting dataset and definitions.
owner: finance-team
tags: [finance, certified]
```

`fixtures/minimal/context/policies/pii-access.policy.yaml`:
```yaml
id: pii-access
description: PII requires elevated role.
rules:
  - priority: 100
    when:
      tags_any: [pii]
    then:
      require_role: data_admin
```

`fixtures/minimal/context/owners/finance-team.owner.yaml`:
```yaml
id: finance-team
display_name: Finance Team
email: finance@acme.com
team: Finance
```

**Step 2: Write the failing test**

`packages/core/src/parser/__tests__/parser.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { discoverFiles, parseFile } from '../index.js';
import { join } from 'node:path';

const FIXTURES = join(import.meta.dirname, '../../../../../fixtures/minimal');

describe('discoverFiles', () => {
  it('finds all context files in the minimal fixture', async () => {
    const files = await discoverFiles(join(FIXTURES, 'context'));
    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files.some(f => f.endsWith('.ctx.yaml'))).toBe(true);
    expect(files.some(f => f.endsWith('.policy.yaml'))).toBe(true);
    expect(files.some(f => f.endsWith('.owner.yaml'))).toBe(true);
  });
});

describe('parseFile', () => {
  it('parses a concept YAML file', async () => {
    const result = await parseFile(
      join(FIXTURES, 'context/concepts/gross-revenue.ctx.yaml')
    );
    expect(result.data.id).toBe('gross-revenue');
    expect(result.data.definition).toBeDefined();
    expect(result.fileType).toBe('concept');
  });

  it('parses a policy YAML file', async () => {
    const result = await parseFile(
      join(FIXTURES, 'context/policies/pii-access.policy.yaml')
    );
    expect(result.data.id).toBe('pii-access');
    expect(result.fileType).toBe('policy');
  });

  it('parses a product YAML file', async () => {
    const result = await parseFile(
      join(FIXTURES, 'context/products/revenue-reporting.ctx.yaml')
    );
    expect(result.data.id).toBe('revenue-reporting');
    expect(result.fileType).toBe('product');
  });

  it('parses an owner YAML file', async () => {
    const result = await parseFile(
      join(FIXTURES, 'context/owners/finance-team.owner.yaml')
    );
    expect(result.data.id).toBe('finance-team');
    expect(result.fileType).toBe('owner');
  });
});
```

**Step 3: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/parser/__tests__/parser.test.ts`
Expected: FAIL

**Step 4: Implement discovery and parser**

`packages/core/src/parser/discover.ts`:
```typescript
import { glob } from 'glob';

const CONTEXT_PATTERNS = [
  '**/*.ctx.yaml',
  '**/*.ctx.yml',
  '**/*.policy.yaml',
  '**/*.policy.yml',
  '**/*.owner.yaml',
  '**/*.owner.yml',
  '**/*.term.yaml',
  '**/*.term.yml',
  '**/*.entity.yaml',
  '**/*.entity.yml',
];

export async function discoverFiles(contextDir: string): Promise<string[]> {
  const files = await glob(CONTEXT_PATTERNS, {
    cwd: contextDir,
    absolute: true,
    nodir: true,
  });
  return files.sort();
}
```

`packages/core/src/parser/parse.ts`:
```typescript
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { basename } from 'node:path';

export type FileType = 'concept' | 'product' | 'entity' | 'policy' | 'term' | 'owner';

export interface ParsedFile {
  filePath: string;
  fileType: FileType;
  data: Record<string, unknown>;
}

function inferFileType(filePath: string): FileType {
  const name = basename(filePath);
  if (name.endsWith('.policy.yaml') || name.endsWith('.policy.yml')) return 'policy';
  if (name.endsWith('.owner.yaml') || name.endsWith('.owner.yml')) return 'owner';
  if (name.endsWith('.term.yaml') || name.endsWith('.term.yml')) return 'term';
  if (name.endsWith('.entity.yaml') || name.endsWith('.entity.yml')) return 'entity';

  // For .ctx.yaml, infer from directory name or content
  if (filePath.includes('/products/') || filePath.includes('\\products\\')) return 'product';
  if (filePath.includes('/entities/') || filePath.includes('\\entities\\')) return 'entity';
  if (filePath.includes('/glossary/') || filePath.includes('\\glossary\\')) return 'term';

  return 'concept'; // default for .ctx.yaml
}

export async function parseFile(filePath: string): Promise<ParsedFile> {
  const content = readFileSync(filePath, 'utf-8');
  const data = parseYaml(content);

  if (typeof data !== 'object' || data === null) {
    throw new Error(`Invalid YAML in ${filePath}: expected an object`);
  }

  const fileType = inferFileType(filePath);

  return { filePath, fileType, data: data as Record<string, unknown> };
}
```

`packages/core/src/parser/index.ts`:
```typescript
export { discoverFiles } from './discover.js';
export { parseFile, type ParsedFile, type FileType } from './parse.js';
```

Update `packages/core/src/index.ts`:
```typescript
export * from './types/index.js';
export * from './schema/index.js';
export * from './config/index.js';
export * from './parser/index.js';
```

**Step 5: Run tests**

Run: `cd packages/core && npx vitest run src/parser/__tests__/parser.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add packages/core/src/parser packages/core/src/index.ts fixtures/
git commit -m "feat(core): add file discovery and YAML parser with test fixtures"
```

---

### Task 6: ContextGraph Builder

**Files:**
- Create: `packages/core/src/graph/builder.ts`
- Create: `packages/core/src/graph/index.ts`
- Test: `packages/core/src/graph/__tests__/builder.test.ts`

**Step 1: Write the failing test**

`packages/core/src/graph/__tests__/builder.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildGraph, createEmptyGraph } from '../index.js';
import type { ContextNode, Concept, Product, Owner, Policy } from '../../types/index.js';

describe('createEmptyGraph', () => {
  it('creates a graph with empty collections', () => {
    const graph = createEmptyGraph();
    expect(graph.nodes.size).toBe(0);
    expect(graph.edges).toHaveLength(0);
  });
});

describe('buildGraph', () => {
  it('builds a graph from an array of nodes', () => {
    const nodes: ContextNode[] = [
      {
        id: 'finance-team', kind: 'owner', displayName: 'Finance Team',
        source: { file: 'a.yaml', line: 1, col: 1 },
      } as Owner,
      {
        id: 'revenue-reporting', kind: 'product', description: 'Revenue data.',
        owner: 'finance-team', tags: ['finance'],
        source: { file: 'b.yaml', line: 1, col: 1 },
      } as Product,
      {
        id: 'gross-revenue', kind: 'concept', definition: 'Total revenue.',
        productId: 'revenue-reporting', owner: 'finance-team', dependsOn: [],
        source: { file: 'c.yaml', line: 1, col: 1 },
      } as Concept,
      {
        id: 'net-revenue', kind: 'concept', definition: 'Revenue after refunds.',
        owner: 'finance-team', dependsOn: ['gross-revenue'],
        source: { file: 'd.yaml', line: 1, col: 1 },
      } as Concept,
    ];

    const graph = buildGraph(nodes);
    expect(graph.nodes.size).toBe(4);
    expect(graph.indexes.byKind.get('concept')).toHaveLength(2);
    expect(graph.indexes.byOwner.get('finance-team')).toHaveLength(3);
    expect(graph.edges.some(e => e.from === 'net-revenue' && e.to === 'gross-revenue')).toBe(true);
    expect(graph.indexes.dependents.get('gross-revenue')).toContain('net-revenue');
  });
});
```

**Step 2: Run test — expected FAIL**

**Step 3: Implement graph builder**

`packages/core/src/graph/builder.ts`:
```typescript
import type { ContextGraph, ContextNode, Edge, NodeKind, Concept, Term } from '../types/index.js';

export function createEmptyGraph(): ContextGraph {
  return {
    nodes: new Map(),
    edges: [],
    indexes: {
      byKind: new Map(), byOwner: new Map(), byTag: new Map(),
      byStatus: new Map(), dependents: new Map(),
    },
  };
}

function addToIndex(map: Map<string, string[]>, key: string, id: string) {
  const list = map.get(key);
  if (list) list.push(id);
  else map.set(key, [id]);
}

export function buildGraph(nodes: ContextNode[]): ContextGraph {
  const graph = createEmptyGraph();
  for (const node of nodes) {
    graph.nodes.set(node.id, node);
    addToIndex(graph.indexes.byKind, node.kind, node.id);
    if (node.owner) addToIndex(graph.indexes.byOwner, node.owner, node.id);
    if (node.tags) for (const tag of node.tags) addToIndex(graph.indexes.byTag, tag, node.id);
    if (node.status) addToIndex(graph.indexes.byStatus, node.status, node.id);
  }
  for (const node of nodes) {
    if (node.kind === 'concept') {
      const c = node as Concept;
      for (const dep of c.dependsOn ?? []) {
        graph.edges.push({ from: c.id, to: dep, type: 'depends_on' });
        addToIndex(graph.indexes.dependents, dep, c.id);
      }
      if (c.productId) graph.edges.push({ from: c.id, to: c.productId, type: 'belongs_to' });
    }
    if (node.owner) graph.edges.push({ from: node.id, to: node.owner, type: 'owned_by' });
    if (node.kind === 'term') {
      const t = node as Term;
      for (const target of t.mapsTo ?? []) graph.edges.push({ from: t.id, to: target, type: 'maps_to' });
    }
  }
  return graph;
}
```

`packages/core/src/graph/index.ts` — export both functions. Update `packages/core/src/index.ts` to add graph export.

**Step 4: Run tests — expected PASS**

**Step 5: Commit** `"feat(core): add ContextGraph builder with indexes"`

---

### Task 7: Compiler Pipeline

**Files:**
- Create: `packages/core/src/compiler/pipeline.ts`
- Create: `packages/core/src/compiler/validate.ts`
- Create: `packages/core/src/compiler/normalize.ts`
- Create: `packages/core/src/compiler/emit.ts`
- Create: `packages/core/src/compiler/index.ts`
- Test: `packages/core/src/compiler/__tests__/pipeline.test.ts`

**Step 1: Write the failing test**

Test that `compile({ contextDir, config })` returns a graph with the expected nodes from the minimal fixture and no schema errors.

**Step 2: Implement validate.ts** — runs Zod schemas on parsed files, converts to typed ContextNode.

**Step 3: Implement normalize.ts** — converts IDs to kebab-case, lowercases tags.

**Step 4: Implement emit.ts** — serializes ContextGraph to Manifest JSON. For git info, use `execFileSync('git', ['rev-parse', '--short', 'HEAD'])` (not exec with string interpolation, to avoid shell injection).

**Step 5: Implement pipeline.ts** — orchestrates discover → parse → validate → normalize → buildGraph, returns `{ graph, diagnostics }`.

**Step 6: Run tests — expected PASS**

**Step 7: Commit** `"feat(core): add compiler pipeline"`

---

### Task 8: Linter Engine + First 4 Rules

**Files:**
- Create: `packages/core/src/linter/engine.ts`
- Create: `packages/core/src/linter/rule.ts`
- Create: `packages/core/src/linter/rules/schema-valid-yaml.ts`
- Create: `packages/core/src/linter/rules/naming-id-kebab-case.ts`
- Create: `packages/core/src/linter/rules/ownership-required.ts`
- Create: `packages/core/src/linter/rules/descriptions-required.ts`
- Create: `packages/core/src/linter/index.ts`
- Test: `packages/core/src/linter/__tests__/engine.test.ts`

**Step 1: Write failing test** — test LintEngine with rules, verify diagnostics for missing owner and non-kebab IDs. Test severity overrides ('off' disables a rule).

**Step 2: Implement LintRule interface:**
```typescript
export interface LintRule {
  id: string;
  defaultSeverity: Severity;
  description: string;
  fixable: boolean;
  run(graph: ContextGraph): Diagnostic[];
}
```

**Step 3: Implement LintEngine** — register rules, run all enabled rules, collect and sort diagnostics.

**Step 4: Implement 4 rules:**
- `schema/valid-yaml` — no-op in engine (diagnostics come from compile phase)
- `naming/id-kebab-case` — check regex `/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/`, fixable
- `ownership/required` — check concept/product/policy has owner field, fixable (stub)
- `descriptions/required` — check definition/description exists, fixable (stub)

**Step 5: Run tests — expected PASS**

**Step 6: Commit** `"feat(core): add lint engine + first 4 rules"`

---

### Task 9: Remaining 8 Lint Rules

**Files:**
- Create 8 rule files in `packages/core/src/linter/rules/`
- Create: `ALL_RULES` array export
- Test: `packages/core/src/linter/__tests__/rules.test.ts`

**Step 1: Write failing tests** for references/resolvable, certified-requires-evidence, docs/examples-required, packaging/no-secrets.

**Step 2: Implement all 8 rules:**
- `references/resolvable` — check depends_on, product_id, maps_to, owner all resolve
- `glossary/no-duplicate-terms` — detect conflicting term definitions
- `concepts/certified-requires-evidence` — certified concepts need evidence array
- `policies/unknown-subject` — policy selectors reference known tags/concepts
- `policies/deny-overrides-allow` — deny rules should have higher priority
- `docs/examples-required` — certified concepts need examples
- `deprecation/require-sunset` — deprecated nodes need sunset date tag
- `packaging/no-secrets` — scan for secret patterns (API keys, passwords)

**Step 3: Export `ALL_RULES` array from `rules/index.ts`**

**Step 4: Run tests — expected PASS**

**Step 5: Commit** `"feat(core): add remaining 8 lint rules"`

---

### Task 10: CLI Scaffold with All Commands

**Files:**
- `packages/cli/src/index.ts` — Commander.js entry with all commands
- `packages/cli/src/commands/init.ts` — scaffold project
- `packages/cli/src/commands/build.ts` — compile + emit manifest
- `packages/cli/src/commands/lint.ts` — compile + lint + format output
- `packages/cli/src/commands/fix.ts` — stub for now
- `packages/cli/src/commands/dev.ts` — stub for now
- `packages/cli/src/commands/site.ts` — nested subcommand, stub
- `packages/cli/src/commands/serve.ts` — stub
- `packages/cli/src/commands/explain.ts` — read manifest + display node
- `packages/cli/src/formatters/pretty.ts` — human-readable diagnostic output
- `packages/cli/src/formatters/json.ts` — JSON diagnostic output

**Step 1: Implement CLI entry** using Commander.js with `.addCommand()` pattern for modular composition. Entry point uses `await program.parseAsync(process.argv)`.

**Step 2: Implement `build` command** — loads config, compiles, runs lint engine, emits manifest to dist/.

**Step 3: Implement `lint` command** — loads config, compiles, runs lint engine, formats output (pretty/json), sets exit code.

**Step 4: Implement `init` command** — creates directory structure and sample files.

**Step 5: Implement `explain` command** — reads manifest, finds node by ID, displays info.

**Step 6: Implement formatters** — pretty (colored terminal output) and JSON.

**Step 7: Stub remaining commands** (fix, dev, site, serve).

**Step 8: Build and verify** `pnpm build && node packages/cli/dist/index.js --help`

**Step 9: Commit** `"feat(cli): add CLI scaffold with build, lint, init, explain commands"`

---

### Task 11: Dev Watch Mode + Fix Command

**Files:**
- Modify: `packages/cli/src/commands/dev.ts`
- Modify: `packages/cli/src/commands/fix.ts`
- Create: `packages/core/src/fixer/index.ts`
- Create: `packages/core/src/fixer/apply.ts`
- Test: `packages/core/src/fixer/__tests__/apply.test.ts`

**Step 1: Implement fixer** — reads diagnostics with fix descriptors, applies text edits to source YAML files. `--write` flag controls disk writes.

**Step 2: Implement fix CLI command** — runs compile + lint, collects fixable diagnostics, applies fixes or shows dry-run output.

**Step 3: Implement dev watch mode** — uses chokidar to watch `context/**`, debounces 100ms, re-runs compile + lint on change, prints summary.

**Step 4: Test fixer** with golden test: create a YAML file missing owner, run fix, verify owner stub is added.

**Step 5: Commit** `"feat(cli): add fix command and dev watch mode"`

---

### Task 12: Site Generator

**Files:**
- Create: `packages/site/src/generator.ts`
- Create: `packages/site/src/templates/layout.ejs`
- Create: `packages/site/src/templates/index.ejs`
- Create: `packages/site/src/templates/concept.ejs`
- Create: `packages/site/src/templates/product.ejs`
- Create: `packages/site/src/templates/policy.ejs`
- Create: `packages/site/src/templates/owner.ejs`
- Create: `packages/site/src/templates/glossary.ejs`
- Create: `packages/site/src/templates/search.ejs`
- Create: `packages/site/src/search/build-index.ts`
- Create: `packages/site/src/assets/style.css` (Tailwind input)
- Create: `packages/site/src/assets/search.js`
- Modify: `packages/cli/src/commands/site.ts`
- Test: `packages/site/src/__tests__/generator.test.ts`

**Step 1: Implement generator.ts** — reads manifest, renders EJS templates to static HTML, builds MiniSearch index, copies assets.

**Step 2: Create EJS templates** — layout with nav + footer; individual pages for concepts, products, policies, owners, glossary, search.

**Step 3: Create Tailwind CSS** — minimal, clean design. Compile with Tailwind CLI at build time.

**Step 4: Implement search** — MiniSearch pre-built index as JSON, client-side search.js.

**Step 5: Wire into CLI** — `context site build` calls generator with manifest path and output dir.

**Step 6: Test** — generate site from minimal fixture, verify expected HTML files exist.

**Step 7: Commit** `"feat(site): add static site generator with EJS templates and search"`

---

### Task 13: MCP Server

**Files:**
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/resources/manifest.ts`
- Create: `packages/mcp/src/resources/concept.ts`
- Create: `packages/mcp/src/resources/product.ts`
- Create: `packages/mcp/src/resources/policy.ts`
- Create: `packages/mcp/src/resources/glossary.ts`
- Create: `packages/mcp/src/tools/search.ts`
- Create: `packages/mcp/src/tools/explain.ts`
- Create: `packages/mcp/src/tools/validate.ts`
- Modify: `packages/cli/src/commands/serve.ts`
- Test: `packages/mcp/src/__tests__/server.test.ts`

**Step 1: Implement MCP server** using `@modelcontextprotocol/sdk`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export function createContextMcpServer(manifest: Manifest) {
  const server = new McpServer({ name: "contextkit", version: "0.1.0" });

  // Register resources
  server.registerResource("manifest", "context://manifest", { ... }, handler);
  server.registerResource("concept", new ResourceTemplate("context://concept/{id}", ...), ...);

  // Register tools
  server.registerTool("context_search", { inputSchema: { query: z.string() } }, handler);
  server.registerTool("context_explain", { inputSchema: { id: z.string() } }, handler);
  server.registerTool("context_validate", {}, handler);

  return server;
}
```

**Step 2: Implement resource handlers** — return manifest JSON, individual concept/product/policy JSON.

**Step 3: Implement tool handlers** — search (text match on IDs, definitions, tags), explain (full node + deps + policies), validate (run compile + lint).

**Step 4: Wire into CLI** — `context serve --stdio` starts stdio transport; `context serve --http PORT` starts streamable HTTP.

**Step 5: Test** — unit test that MCP server registers expected tools/resources.

**Step 6: Commit** `"feat(mcp): add MCP server with resources and tools"`

---

### Task 14: Integration Tests + Error Fixture

**Files:**
- Create: `fixtures/errors/context/concepts/bad-id.ctx.yaml` (non-kebab-case)
- Create: `fixtures/errors/context/concepts/no-owner.ctx.yaml` (missing owner)
- Create: `fixtures/errors/context/concepts/unresolvable.ctx.yaml` (bad depends_on)
- Create: `fixtures/errors/contextkit.config.yaml`
- Create: `fixtures/full/` (comprehensive example)
- Test: `packages/core/src/__tests__/integration.test.ts`

**Step 1: Create error fixtures** with known violations.

**Step 2: Write integration tests** — compile error fixture, verify specific diagnostics are produced.

**Step 3: Write full fixture integration test** — compile full fixture, verify manifest structure.

**Step 4: Commit** `"test: add integration tests with error and full fixtures"`

---

### Task 15: create-contextkit Scaffolder

**Files:**
- Create: `create-contextkit/package.json`
- Create: `create-contextkit/src/index.ts`
- Create: `create-contextkit/tsup.config.ts`
- Create: `create-contextkit/templates/minimal/`

**Step 1: Create package** with bin entry `create-contextkit`.

**Step 2: Implement scaffolder** — copies template files, replaces project name, runs pnpm install.

**Step 3: Build and test** — `node create-contextkit/dist/index.js test-project` creates expected structure.

**Step 4: Commit** `"feat: add create-contextkit scaffolder"`

---

### Task 16: Final Wiring, Polish, and Verification

**Step 1: Verify all commands work end-to-end** in the minimal fixture:
```bash
cd fixtures/minimal && context lint && context build && context explain gross-revenue
```

**Step 2: Fix any issues found**.

**Step 3: Run full test suite**: `pnpm test`

**Step 4: Final commit** `"chore: polish and verify full v0.1 implementation"`
