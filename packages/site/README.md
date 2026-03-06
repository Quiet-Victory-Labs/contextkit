# @runcontext/site

Static documentation site generator for [ContextKit](https://github.com/erickittelson/ContextKit).

## What it does

Generates a browsable HTML documentation site from your compiled ContextKit metadata:

- **Model pages** — datasets, fields, schema browser, rules, relationships
- **Glossary** — all business terms with definitions, synonyms, and linked fields
- **Owner pages** — team ownership with governed models
- **Search** — full-text search across all entities
- **Tier badges** — visual Bronze/Silver/Gold status per model

## Usage

Through the CLI:

```bash
npx @runcontext/cli build   # compile context files first
npx @runcontext/cli site    # generate site/ directory
```

Then open `site/index.html` or serve with any static file server:

```bash
npx serve site -l 8080
```

## Programmatic Usage

```typescript
import { generateSite } from '@runcontext/site';

await generateSite({
  manifest,        // compiled ContextKit manifest
  outputDir: './site',
  config: { base_path: '.' }
});
```

## Part of ContextKit

See the [ContextKit repository](https://github.com/erickittelson/ContextKit) for full documentation.

## License

MIT
