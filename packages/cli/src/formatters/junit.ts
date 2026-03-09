import type { Diagnostic } from '@runcontext/core';

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Format diagnostics as JUnit XML.
 * Consumed by Jenkins, GitLab CI, CircleCI, Azure DevOps.
 * Groups diagnostics by file as <testsuite>, each diagnostic as <testcase> with <failure>.
 */
export function formatJUnit(diagnostics: Diagnostic[]): string {
  // Group diagnostics by file
  const byFile = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    const file = d.location.file;
    if (!byFile.has(file)) {
      byFile.set(file, []);
    }
    byFile.get(file)!.push(d);
  }

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuites name="RunContext" tests="${diagnostics.length}" failures="${diagnostics.length}">`,
  );

  for (const [file, diags] of byFile) {
    lines.push(
      `  <testsuite name="${escapeXml(file)}" tests="${diags.length}" failures="${diags.length}">`,
    );

    for (const d of diags) {
      const name = `${d.ruleId} (${d.location.line}:${d.location.column})`;
      lines.push(`    <testcase name="${escapeXml(name)}" classname="${escapeXml(file)}">`);
      lines.push(
        `      <failure message="${escapeXml(d.message)}" type="${d.severity}">${escapeXml(d.ruleId)}: ${escapeXml(d.message)} at ${escapeXml(file)}:${d.location.line}:${d.location.column}</failure>`,
      );
      lines.push('    </testcase>');
    }

    lines.push('  </testsuite>');
  }

  lines.push('</testsuites>');
  return lines.join('\n');
}
