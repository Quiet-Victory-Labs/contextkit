import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/**
 * Runs the compile + lint pipeline on a context directory and returns diagnostics.
 */
export async function validateContext(rootDir?: string): Promise<CallToolResult> {
  try {
    // Dynamic import to avoid circular dependency issues at load time
    const { compile, LintEngine, ALL_RULES } = await import('@runcontext/core');

    const contextDir = rootDir ?? process.cwd();

    // Run the compiler pipeline
    const compileResult = await compile({
      contextDir,
      config: {},
    });

    // Run the linter
    const engine = new LintEngine();
    for (const rule of ALL_RULES) {
      engine.register(rule);
    }
    const lintDiagnostics = engine.run(compileResult.graph);

    // Combine diagnostics
    const allDiagnostics = [...compileResult.diagnostics, ...lintDiagnostics];

    const summary = {
      contextDir,
      compileDiagnostics: compileResult.diagnostics.length,
      lintDiagnostics: lintDiagnostics.length,
      totalDiagnostics: allDiagnostics.length,
      errors: allDiagnostics.filter((d) => d.severity === 'error').length,
      warnings: allDiagnostics.filter((d) => d.severity === 'warning').length,
      diagnostics: allDiagnostics,
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: `Validation failed: ${message}` }, null, 2),
        },
      ],
      isError: true,
    };
  }
}
