// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vercel from '@astrojs/vercel';

export default defineConfig({
  site: 'https://docs.runcontext.dev',
  output: 'static',
  adapter: vercel(),
  integrations: [
    starlight({
      title: 'RunContext Docs',
      logo: {
        dark: './src/assets/logo-dark.svg',
        light: './src/assets/logo-light.svg',
        replacesTitle: false,
      },
      favicon: '/favicon.svg',
      description: 'RunContext documentation — CLI reference, MCP server, semantic plane concepts, and RunContext Cloud.',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/Quiet-Victory-Labs/runcontext' },
      ],
      components: {
        SiteTitle: './src/components/SiteTitle.astro',
        Footer: './src/components/Footer.astro',
      },
      customCss: ['@runcontext/uxd/css/tokens', './src/styles/custom.css'],
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
        { tag: 'link', attrs: { href: 'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@300;400;500;600&family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap', rel: 'stylesheet' } },
      ],
      sidebar: [
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
          label: 'RunContext Cloud',
          items: [
            { label: 'Overview', slug: 'cloud/overview' },
            { label: 'Sign Up & Onboarding', slug: 'cloud/signup' },
            { label: 'Dashboard', slug: 'cloud/dashboard' },
            { label: 'Cloud API', slug: 'cloud/api' },
          ],
        },
      ],
    }),
  ],
});
