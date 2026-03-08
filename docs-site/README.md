# ContextKit Documentation Site

The official documentation site for [ContextKit](https://github.com/Quiet-Victory-Labs/contextkit), built with [Astro Starlight](https://starlight.astro.build).

## Development

```bash
cd docs-site
npm install
npm run dev      # http://localhost:4321
npm run build    # Production build → ./dist/
```

## Deployment

Deployed automatically to Vercel on push to `master`. The root `vercel.json` points Vercel at this directory.

## Content

Documentation lives in `src/content/docs/` as `.mdx` files. The sidebar is configured in `astro.config.mjs`.
