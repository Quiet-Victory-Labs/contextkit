import { ZodError, type ZodSchema } from 'zod';
import type { FileKind, ParsedFile } from '../parser/index.js';
import type { Diagnostic } from '../types/index.js';
import {
  osiDocumentSchema,
  governanceFileSchema,
  rulesFileSchema,
  lineageFileSchema,
  termFileSchema,
  ownerFileSchema,
} from '../schema/index.js';

export interface ValidateResult {
  kind: FileKind;
  data?: any;
  diagnostics: Diagnostic[];
}

const SCHEMA_MAP: Record<FileKind, ZodSchema> = {
  model: osiDocumentSchema,
  governance: governanceFileSchema,
  rules: rulesFileSchema,
  lineage: lineageFileSchema,
  term: termFileSchema,
  owner: ownerFileSchema,
};

function zodErrorToDiagnostics(err: ZodError, source: ParsedFile['source']): Diagnostic[] {
  return err.issues.map((issue) => ({
    ruleId: 'schema/invalid',
    severity: 'error' as const,
    message: `${issue.path.join('.')}: ${issue.message}`,
    location: { file: source.file, line: source.line, column: source.column },
    fixable: false,
  }));
}

export function validate(parsed: ParsedFile): ValidateResult {
  const schema = SCHEMA_MAP[parsed.kind];
  const parseResult = schema.safeParse(parsed.data);

  if (!parseResult.success) {
    return {
      kind: parsed.kind,
      data: undefined,
      diagnostics: zodErrorToDiagnostics(parseResult.error, parsed.source),
    };
  }

  let data = parseResult.data;

  // For model kind, extract the first semantic_model entry
  if (parsed.kind === 'model') {
    const doc = data as { semantic_model: unknown[] };
    data = doc.semantic_model[0];
  }

  return {
    kind: parsed.kind,
    data,
    diagnostics: [],
  };
}
