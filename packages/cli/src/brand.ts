export const brand = {
  banner: 'RunContext — AI-ready data starts here',
  setupComplete: 'Your semantic plane is live. AI agents can now query your data with context.',
  mcpServing: 'Serving semantic plane via MCP. Connected AI tools will now have context.',
  noProducts: 'No data products found. Run `context setup` to build your first one.',
  buildSuccess: (n: number) => `Semantic plane compiled: ${n} data product${n === 1 ? '' : 's'} ready.`,
  tierBadge: (tier: string) => tier === 'gold' ? 'AI-Ready' : tier === 'silver' ? 'Trusted' : 'Discoverable',
  footer: 'Powered by RunContext · Open Semantic Interchange',
};
