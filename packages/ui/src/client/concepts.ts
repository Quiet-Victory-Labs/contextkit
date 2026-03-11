export const CONCEPTS: Record<string, { label: string; definition: string }> = {
  contextLayer: {
    label: 'Context Layer',
    definition: 'Your organization\'s complete semantic knowledge base — what your data means, who owns it, and how it should be used.',
  },
  semanticPlane: {
    label: 'Semantic Plane',
    definition: 'A domain-scoped context package (e.g., "Sales," "Finance"). The primary unit of your context layer.',
  },
  mcpEndpoint: {
    label: 'MCP Endpoint',
    definition: 'The API that serves your context layer to AI agents, tools, and applications via the Model Context Protocol.',
  },
  guardrails: {
    label: 'Guardrails',
    definition: 'Rules that constrain how data is used, accessed, or interpreted by AI — ensuring safety and compliance.',
  },
  governance: {
    label: 'Governance',
    definition: 'Ownership, trust levels, and data stewardship policies that define who is responsible for your data context.',
  },
  models: {
    label: 'Models',
    definition: 'Structured definitions of data entities and relationships within a semantic plane.',
  },
  trustLevel: {
    label: 'Trust Level',
    definition: 'A confidence rating (verified, reviewed, draft) indicating how reliable a piece of data context is.',
  },
  glossary: {
    label: 'Glossary',
    definition: 'Plain-language definitions of key terms so everyone speaks the same language about your data.',
  },
  businessRules: {
    label: 'Business Rules',
    definition: 'Domain-specific logic, calculations, and validation that govern how data should be interpreted.',
  },
  bronzeTier: {
    label: 'Bronze Tier',
    definition: 'Schema metadata only — table names, column names, types, and row counts. The starting point.',
  },
  silverTier: {
    label: 'Silver Tier',
    definition: 'Column descriptions, sample values, and trust tags. Adds human-readable context to raw schema.',
  },
  goldTier: {
    label: 'Gold Tier',
    definition: 'Join rules, grain statements, semantic roles, golden queries, and guardrail filters. Full context for AI agents.',
  },
};
