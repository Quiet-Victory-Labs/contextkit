import { glob } from 'glob';

const CONTEXT_PATTERNS = [
  '**/*.ctx.yaml', '**/*.ctx.yml',
  '**/*.policy.yaml', '**/*.policy.yml',
  '**/*.owner.yaml', '**/*.owner.yml',
  '**/*.term.yaml', '**/*.term.yml',
  '**/*.entity.yaml', '**/*.entity.yml',
];

export async function discoverFiles(contextDir: string): Promise<string[]> {
  const files = await glob(CONTEXT_PATTERNS, { cwd: contextDir, absolute: true, nodir: true });
  return files.sort();
}
