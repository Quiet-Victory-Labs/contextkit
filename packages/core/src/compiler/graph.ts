import type {
  ContextGraph,
  OsiSemanticModel,
  GovernanceFile,
  RulesFile,
  LineageFile,
  TermFile,
  OwnerFile,
  TierScore,
  SourceFileInfo,
} from '../types/index.js';
import type { ValidateResult } from './validate.js';

export function createEmptyGraph(): ContextGraph {
  return {
    models: new Map<string, OsiSemanticModel>(),
    governance: new Map<string, GovernanceFile>(),
    rules: new Map<string, RulesFile>(),
    lineage: new Map<string, LineageFile>(),
    terms: new Map<string, TermFile>(),
    owners: new Map<string, OwnerFile>(),
    tiers: new Map<string, TierScore>(),
    sourceMap: new Map<string, SourceFileInfo>(),
    indexes: {
      byOwner: new Map<string, string[]>(),
      byTag: new Map<string, string[]>(),
      byTrust: new Map<string, string[]>(),
      modelToGovernance: new Map<string, string>(),
      modelToRules: new Map<string, string>(),
      modelToLineage: new Map<string, string>(),
    },
  };
}

/** Helper to push a value to a map of arrays. */
function pushToIndex(map: Map<string, string[]>, key: string, value: string): void {
  const existing = map.get(key);
  if (existing) {
    existing.push(value);
  } else {
    map.set(key, [value]);
  }
}

export function buildGraph(results: ValidateResult[]): ContextGraph {
  const graph = createEmptyGraph();

  for (const result of results) {
    // Skip entries with errors or no data
    const hasErrors = result.diagnostics.some((d) => d.severity === 'error');
    if (hasErrors || result.data == null) continue;

    switch (result.kind) {
      case 'model': {
        const model = result.data as OsiSemanticModel;
        graph.models.set(model.name, model);
        if (result.sourceFile) {
          graph.sourceMap.set(`model:${model.name}`, { filePath: result.sourceFile, content: '' });
        }
        break;
      }
      case 'governance': {
        const gov = result.data as GovernanceFile;
        graph.governance.set(gov.model, gov);
        if (result.sourceFile) {
          graph.sourceMap.set(`governance:${gov.model}`, { filePath: result.sourceFile, content: '' });
        }
        break;
      }
      case 'rules': {
        const rules = result.data as RulesFile;
        graph.rules.set(rules.model, rules);
        if (result.sourceFile) {
          graph.sourceMap.set(`rules:${rules.model}`, { filePath: result.sourceFile, content: '' });
        }
        break;
      }
      case 'lineage': {
        const lineage = result.data as LineageFile;
        graph.lineage.set(lineage.model, lineage);
        if (result.sourceFile) {
          graph.sourceMap.set(`lineage:${lineage.model}`, { filePath: result.sourceFile, content: '' });
        }
        break;
      }
      case 'term': {
        const term = result.data as TermFile;
        graph.terms.set(term.id, term);
        if (result.sourceFile) {
          graph.sourceMap.set(`term:${term.id}`, { filePath: result.sourceFile, content: '' });
        }
        break;
      }
      case 'owner': {
        const owner = result.data as OwnerFile;
        graph.owners.set(owner.id, owner);
        if (result.sourceFile) {
          graph.sourceMap.set(`owner:${owner.id}`, { filePath: result.sourceFile, content: '' });
        }
        break;
      }
    }
  }

  // Populate indexes from governance entries
  for (const [govKey, gov] of graph.governance) {
    // byOwner
    pushToIndex(graph.indexes.byOwner, gov.owner, govKey);

    // byTag
    if (gov.tags) {
      for (const tag of gov.tags) {
        pushToIndex(graph.indexes.byTag, tag, govKey);
      }
    }

    // byTrust
    if (gov.trust) {
      pushToIndex(graph.indexes.byTrust, gov.trust, govKey);
    }

    // modelToGovernance
    graph.indexes.modelToGovernance.set(gov.model, govKey);
  }

  // modelToRules
  for (const [rulesKey, rules] of graph.rules) {
    graph.indexes.modelToRules.set(rules.model, rulesKey);
  }

  // modelToLineage
  for (const [lineageKey, lineage] of graph.lineage) {
    graph.indexes.modelToLineage.set(lineage.model, lineageKey);
  }

  return graph;
}
