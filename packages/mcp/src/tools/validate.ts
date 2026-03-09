import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ContextGraph, Diagnostic } from '@runcontext/core';
import { LintEngine, ALL_RULES } from '@runcontext/core';

export interface ValidateResult {
  totalDiagnostics: number;
  errors: number;
  warnings: number;
  diagnostics: Diagnostic[];
}

/**
 * Run the full linter against the context graph.
 */
export function validateGraph(graph: ContextGraph): ValidateResult {
  const engine = new LintEngine();
  for (const rule of ALL_RULES) {
    engine.register(rule);
  }

  const diagnostics = engine.run(graph);
  const errors = diagnostics.filter((d) => d.severity === 'error').length;
  const warnings = diagnostics.filter((d) => d.severity === 'warning').length;

  return {
    totalDiagnostics: diagnostics.length,
    errors,
    warnings,
    diagnostics,
  };
}

/**
 * Register the `context_validate` tool.
 * Runs the linter and returns diagnostics.
 */
export function registerValidateTool(server: McpServer, graph: ContextGraph): void {
  server.tool(
    'context_validate',
    'Run RunContext linter against the context graph and return diagnostics',
    {},
    async () => {
      const result = validateGraph(graph);
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    },
  );
}
