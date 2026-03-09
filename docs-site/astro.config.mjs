// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  integrations: [
    starlight({
      title: 'ContextKit',
      logo: {
        dark: './src/assets/logo-dark.svg',
        light: './src/assets/logo-light.svg',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      description: 'ContextKit — turn your database into an AI-ready data product. Fill out a Context Brief, connect your database, and the pipeline builds a semantic plane automatically. Serve it to Claude Code, Cursor, and Copilot via MCP.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Quiet-Victory-Labs/contextkit' },
      ],
      // editLink removed — not needed for public docs
      customCss: ['./src/styles/custom.css'],
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
        { tag: 'link', attrs: { href: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap', rel: 'stylesheet' } },
      ],
      sidebar: [
        { label: 'Pricing', slug: 'pricing' },
        { label: 'Integrations', slug: 'integrations' },
        {
          label: 'Legal',
          items: [
            { label: 'Privacy Policy', slug: 'legal/privacy' },
            { label: 'Terms of Service', slug: 'legal/terms' },
          ],
        },
        {
          label: 'Getting Started',
          items: [
            { label: 'Introduction', slug: 'getting-started/introduction' },
            { label: 'Quick Start', slug: 'getting-started/quick-start' },
            { label: 'Installation', slug: 'getting-started/installation' },
          ],
        },
        {
          label: 'Core Concepts',
          items: [
            { label: 'Tier System', slug: 'concepts/tiers' },
            { label: 'File Structure', slug: 'concepts/file-structure' },
            { label: 'OSI Specification', slug: 'concepts/osi' },
            { label: 'Data Products', slug: 'concepts/data-products' },
          ],
        },
        {
          label: 'CLI Reference',
          items: [
            { label: 'Overview', slug: 'cli/overview' },
            { label: 'setup', slug: 'cli/setup' },
            { label: 'new', slug: 'cli/new' },
            { label: 'introspect', slug: 'cli/introspect' },
            { label: 'enrich', slug: 'cli/enrich' },
            { label: 'lint & fix', slug: 'cli/lint' },
            { label: 'build & tier', slug: 'cli/build' },
            { label: 'explain', slug: 'cli/explain' },
            { label: 'rules', slug: 'cli/rules' },
            { label: 'validate-osi', slug: 'cli/validate-osi' },
            { label: 'verify', slug: 'cli/verify' },
            { label: 'blueprint', slug: 'cli/blueprint' },
            { label: 'serve', slug: 'cli/serve' },
            { label: 'site', slug: 'cli/site' },
            { label: 'dev', slug: 'cli/dev' },
            { label: 'init', slug: 'cli/init' },
          ],
        },
        {
          label: 'MCP Server',
          items: [
            { label: 'Overview', slug: 'mcp/overview' },
            { label: 'Resources', slug: 'mcp/resources' },
            { label: 'Tools', slug: 'mcp/tools' },
            { label: 'Configuration', slug: 'mcp/configuration' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Lint Rules', slug: 'reference/lint-rules' },
            { label: 'Database Support', slug: 'reference/databases' },
            { label: 'Config File', slug: 'reference/config' },
          ],
        },
        {
          label: 'Blog',
          items: [
            { label: 'Why AI Agents Write Wrong SQL', slug: 'blog/why-ai-agents-write-wrong-sql' },
            { label: 'How to Build a Semantic Layer for AI Agents', slug: 'blog/how-to-build-semantic-layer-for-ai-agents' },
            { label: 'Open Semantic Interchange', slug: 'blog/open-semantic-interchange' },
            { label: 'BYOMCP: Connecting Data to Every AI Tool', slug: 'blog/byomcp-connecting-data-to-every-ai-tool' },
            { label: 'From Bronze to Gold: Curating Data Products', slug: 'blog/bronze-to-gold-curating-data-products-with-ai' },
            { label: 'Institutional Knowledge is Your AI\'s Missing Context', slug: 'blog/institutional-knowledge-is-your-ais-missing-context' },
            { label: 'ContextKit vs Alation vs Atlan', slug: 'blog/contextkit-vs-alation-vs-atlan' },
            { label: 'Serve Data Catalog to Claude Code via MCP', slug: 'blog/how-to-serve-data-catalog-to-claude-code-via-mcp' },
          ],
        },
      ],
    }),
  ],
});
