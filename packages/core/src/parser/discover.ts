import { glob } from 'glob';
import path from 'node:path';

export type FileKind = 'model' | 'governance' | 'rules' | 'lineage' | 'term' | 'owner';

export interface DiscoveredFile {
  path: string;
  kind: FileKind;
}

const PATTERNS: Record<FileKind, string> = {
  model: '**/*.osi.yaml',
  governance: '**/*.governance.yaml',
  rules: '**/*.rules.yaml',
  lineage: '**/*.lineage.yaml',
  term: '**/*.term.yaml',
  owner: '**/*.owner.yaml',
};

export async function discoverFiles(
  contextDir: string,
  ignore?: string[],
): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = [];
  for (const [kind, pattern] of Object.entries(PATTERNS)) {
    const matches = await glob(pattern, {
      cwd: contextDir,
      absolute: true,
      ignore: ignore ?? [],
    });
    for (const match of matches) {
      files.push({ path: match, kind: kind as FileKind });
    }
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}
