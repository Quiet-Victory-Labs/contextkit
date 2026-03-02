import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { basename } from 'node:path';

export type FileType = 'concept' | 'product' | 'entity' | 'policy' | 'term' | 'owner';

export interface ParsedFile {
  filePath: string;
  fileType: FileType;
  data: Record<string, unknown>;
}

function inferFileType(filePath: string): FileType {
  const name = basename(filePath);
  if (name.endsWith('.policy.yaml') || name.endsWith('.policy.yml')) return 'policy';
  if (name.endsWith('.owner.yaml') || name.endsWith('.owner.yml')) return 'owner';
  if (name.endsWith('.term.yaml') || name.endsWith('.term.yml')) return 'term';
  if (name.endsWith('.entity.yaml') || name.endsWith('.entity.yml')) return 'entity';
  // For .ctx.yaml, infer from directory
  if (filePath.includes('/products/')) return 'product';
  if (filePath.includes('/entities/')) return 'entity';
  if (filePath.includes('/glossary/')) return 'term';
  return 'concept'; // default
}

export async function parseFile(filePath: string): Promise<ParsedFile> {
  const content = readFileSync(filePath, 'utf-8');
  const data = parseYaml(content);
  if (typeof data !== 'object' || data === null) {
    throw new Error(`Invalid YAML in ${filePath}: expected an object`);
  }
  return { filePath, fileType: inferFileType(filePath), data: data as Record<string, unknown> };
}
