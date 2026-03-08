import type { Diagnostic } from '@runcontext/core';

interface SarifRuleDescriptor {
  id: string;
  shortDescription: { text: string };
}

interface SarifResult {
  ruleId: string;
  level: 'error' | 'warning' | 'note';
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: { startLine: number; startColumn: number };
    };
  }>;
}

interface SarifRun {
  tool: {
    driver: {
      name: string;
      version: string;
      informationUri: string;
      rules: SarifRuleDescriptor[];
    };
  };
  results: SarifResult[];
}

interface SarifLog {
  $schema: string;
  version: string;
  runs: SarifRun[];
}

function mapSeverity(severity: string): 'error' | 'warning' | 'note' {
  switch (severity) {
    case 'error':
      return 'error';
    case 'warning':
      return 'warning';
    default:
      return 'note';
  }
}

/**
 * Format diagnostics as SARIF v2.1.0 JSON.
 * GitHub natively consumes this for code scanning alerts.
 */
export function formatSarif(diagnostics: Diagnostic[]): string {
  // Collect unique rules
  const ruleMap = new Map<string, SarifRuleDescriptor>();
  for (const d of diagnostics) {
    if (!ruleMap.has(d.ruleId)) {
      ruleMap.set(d.ruleId, {
        id: d.ruleId,
        shortDescription: { text: d.message },
      });
    }
  }

  const results: SarifResult[] = diagnostics.map((d) => ({
    ruleId: d.ruleId,
    level: mapSeverity(d.severity),
    message: { text: d.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: d.location.file },
          region: {
            startLine: d.location.line,
            startColumn: d.location.column,
          },
        },
      },
    ],
  }));

  const sarif: SarifLog = {
    $schema:
      'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'ContextKit',
            version: '0.5.0',
            informationUri: 'https://github.com/Quiet-Victory-Labs/contextkit',
            rules: Array.from(ruleMap.values()),
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
