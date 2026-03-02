import { readFile } from 'node:fs/promises';
import { parse as parseYaml } from 'yaml';
import type { FileKind } from './discover.js';

export interface ParsedFile {
  kind: FileKind;
  data: unknown;
  source: { file: string; line: number; column: number };
}

export async function parseFile(filePath: string, kind: FileKind): Promise<ParsedFile> {
  const content = await readFile(filePath, 'utf-8');
  const data = parseYaml(content);
  return {
    kind,
    data,
    source: { file: filePath, line: 1, column: 1 },
  };
}
