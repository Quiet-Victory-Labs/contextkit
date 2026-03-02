import type { ContextNode, Diagnostic, PolicyRule } from '../types/index.js';
import type { ParsedFile } from '../parser/index.js';
import {
  conceptFileSchema,
  productFileSchema,
  policyFileSchema,
  entityFileSchema,
  termFileSchema,
  ownerFileSchema,
} from '../schema/index.js';

export interface ValidateResult {
  node?: ContextNode;
  diagnostics: Diagnostic[];
}

/**
 * Map from YAML file types to the corresponding Zod schemas.
 */
const SCHEMAS = {
  concept: conceptFileSchema,
  product: productFileSchema,
  policy: policyFileSchema,
  entity: entityFileSchema,
  term: termFileSchema,
  owner: ownerFileSchema,
} as const;

/**
 * Validate a ParsedFile using the appropriate Zod schema and convert
 * the raw snake_case YAML data into a typed camelCase ContextNode.
 */
export function validateFile(parsed: ParsedFile): ValidateResult {
  const schema = SCHEMAS[parsed.fileType];
  const result = schema.safeParse(parsed.data);

  if (!result.success) {
    const diagnostics: Diagnostic[] = result.error.issues.map((issue) => ({
      ruleId: 'schema/invalid',
      severity: 'error' as const,
      message: `${issue.path.join('.')}: ${issue.message}`,
      source: { file: parsed.filePath, line: 1, col: 1 },
      fixable: false,
    }));
    return { diagnostics };
  }

  const data = result.data;
  const source = { file: parsed.filePath, line: 1, col: 1 };

  let node: ContextNode;

  switch (parsed.fileType) {
    case 'concept': {
      const d = data as typeof conceptFileSchema._output;
      node = {
        id: d.id,
        kind: 'concept',
        source,
        definition: d.definition,
        owner: d.owner,
        tags: d.tags,
        status: d.status,
        certified: d.certified,
        productId: d.product_id,
        dependsOn: d.depends_on,
        evidence: d.evidence,
        examples: d.examples,
        description: d.description,
      };
      break;
    }
    case 'product': {
      const d = data as typeof productFileSchema._output;
      node = {
        id: d.id,
        kind: 'product',
        source,
        description: d.description,
        owner: d.owner,
        tags: d.tags,
        status: d.status,
      };
      break;
    }
    case 'policy': {
      const d = data as typeof policyFileSchema._output;
      node = {
        id: d.id,
        kind: 'policy',
        source,
        description: d.description,
        owner: d.owner,
        tags: d.tags,
        status: d.status,
        rules: d.rules.map((r): PolicyRule => ({
          priority: r.priority,
          when: {
            tagsAny: r.when.tags_any,
            conceptIds: r.when.concept_ids,
            status: r.when.status,
          },
          then: {
            requireRole: r.then.require_role,
            deny: r.then.deny,
            warn: r.then.warn,
          },
        })),
      };
      break;
    }
    case 'entity': {
      const d = data as typeof entityFileSchema._output;
      node = {
        id: d.id,
        kind: 'entity',
        source,
        definition: d.definition,
        owner: d.owner,
        tags: d.tags,
        status: d.status,
        fields: d.fields,
        description: d.description,
      };
      break;
    }
    case 'term': {
      const d = data as typeof termFileSchema._output;
      node = {
        id: d.id,
        kind: 'term',
        source,
        definition: d.definition,
        owner: d.owner,
        tags: d.tags,
        synonyms: d.synonyms,
        mapsTo: d.maps_to,
      };
      break;
    }
    case 'owner': {
      const d = data as typeof ownerFileSchema._output;
      node = {
        id: d.id,
        kind: 'owner',
        source,
        displayName: d.display_name,
        email: d.email,
        team: d.team,
        tags: d.tags,
      };
      break;
    }
  }

  return { node, diagnostics: [] };
}
