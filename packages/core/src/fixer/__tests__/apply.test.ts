import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { applyFixes } from '../apply.js';
import type { Diagnostic } from '../../types/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fixer-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmp(name: string, content: string): string {
  const filePath = path.join(tmpDir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}

function makeDiagnostic(overrides: Partial<Diagnostic> & { fix?: Diagnostic['fix'] }): Diagnostic {
  return {
    ruleId: 'test/rule',
    severity: 'error',
    message: 'test diagnostic',
    source: { file: 'test.yaml', line: 1, col: 1 },
    fixable: true,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyFixes', () => {
  describe('golden test: add missing owner', () => {
    it('inserts owner stub into a YAML file missing owner', () => {
      const yamlContent = [
        'id: gross-revenue',
        'kind: concept',
        'definition: Total invoiced revenue before refunds.',
        '',
      ].join('\n');

      const filePath = writeTmp('concepts/gross-revenue.ctx.yaml', yamlContent);

      const diagnostic = makeDiagnostic({
        ruleId: 'ownership/required',
        message: 'concept "gross-revenue" is missing a required owner',
        source: { file: filePath, line: 3, col: 1 },
        fixable: true,
        fix: {
          description: 'Add owner field',
          edits: [
            {
              file: filePath,
              range: { startLine: 3, startCol: 1, endLine: 3, endCol: 1 },
              newText: 'owner: TODO\n',
            },
          ],
        },
      });

      const results = applyFixes([diagnostic]);

      expect(results).toHaveLength(1);
      expect(results[0]!.file).toBe(filePath);
      expect(results[0]!.editsApplied).toBe(1);
      expect(results[0]!.newContent).toContain('owner: TODO');

      // Verify the owner line is inserted before the definition line
      const lines = results[0]!.newContent.split('\n');
      const ownerIdx = lines.findIndex((l) => l.includes('owner: TODO'));
      const defIdx = lines.findIndex((l) => l.includes('definition:'));
      expect(ownerIdx).toBeGreaterThanOrEqual(0);
      expect(defIdx).toBeGreaterThan(ownerIdx);
    });
  });

  describe('multiple fixes in the same file', () => {
    it('applies multiple insertions correctly (reverse order prevents offset corruption)', () => {
      const yamlContent = [
        'id: gross-revenue',
        'kind: concept',
        'definition: Total invoiced revenue.',
        '',
      ].join('\n');

      const filePath = writeTmp('multi.yaml', yamlContent);

      const diag1 = makeDiagnostic({
        ruleId: 'ownership/required',
        source: { file: filePath, line: 3, col: 1 },
        fix: {
          description: 'Add owner field',
          edits: [
            {
              file: filePath,
              range: { startLine: 3, startCol: 1, endLine: 3, endCol: 1 },
              newText: 'owner: TODO\n',
            },
          ],
        },
      });

      const diag2 = makeDiagnostic({
        ruleId: 'descriptions/required',
        source: { file: filePath, line: 4, col: 1 },
        fix: {
          description: 'Add description field',
          edits: [
            {
              file: filePath,
              range: { startLine: 4, startCol: 1, endLine: 4, endCol: 1 },
              newText: 'description: TODO\n',
            },
          ],
        },
      });

      const results = applyFixes([diag1, diag2]);

      expect(results).toHaveLength(1);
      expect(results[0]!.editsApplied).toBe(2);
      expect(results[0]!.newContent).toContain('owner: TODO');
      expect(results[0]!.newContent).toContain('description: TODO');
    });
  });

  describe('fixes in different files', () => {
    it('returns separate results for each file', () => {
      const yaml1 = 'id: concept-a\nkind: concept\n';
      const yaml2 = 'id: concept-b\nkind: concept\n';

      const file1 = writeTmp('a.yaml', yaml1);
      const file2 = writeTmp('b.yaml', yaml2);

      const diag1 = makeDiagnostic({
        source: { file: file1, line: 2, col: 1 },
        fix: {
          description: 'Add owner',
          edits: [
            {
              file: file1,
              range: { startLine: 2, startCol: 1, endLine: 2, endCol: 1 },
              newText: 'owner: TODO\n',
            },
          ],
        },
      });

      const diag2 = makeDiagnostic({
        source: { file: file2, line: 2, col: 1 },
        fix: {
          description: 'Add owner',
          edits: [
            {
              file: file2,
              range: { startLine: 2, startCol: 1, endLine: 2, endCol: 1 },
              newText: 'owner: TODO\n',
            },
          ],
        },
      });

      const results = applyFixes([diag1, diag2]);

      expect(results).toHaveLength(2);

      const result1 = results.find((r) => r.file === file1);
      const result2 = results.find((r) => r.file === file2);

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result1!.newContent).toContain('owner: TODO');
      expect(result2!.newContent).toContain('owner: TODO');
    });
  });

  describe('diagnostics without fixes are skipped', () => {
    it('ignores non-fixable diagnostics', () => {
      const yaml = 'id: test\nkind: concept\n';
      const filePath = writeTmp('skip.yaml', yaml);

      const nonFixable = makeDiagnostic({
        fixable: false,
        fix: undefined,
        source: { file: filePath, line: 1, col: 1 },
      });

      const results = applyFixes([nonFixable]);
      expect(results).toHaveLength(0);
    });

    it('ignores diagnostics with fixable=true but no fix property', () => {
      const yaml = 'id: test\nkind: concept\n';
      const filePath = writeTmp('skip2.yaml', yaml);

      const noFix = makeDiagnostic({
        fixable: true,
        fix: undefined,
        source: { file: filePath, line: 1, col: 1 },
      });

      const results = applyFixes([noFix]);
      expect(results).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty diagnostics', () => {
      const results = applyFixes([]);
      expect(results).toHaveLength(0);
    });

    it('skips files that do not exist on disk', () => {
      const diag = makeDiagnostic({
        fix: {
          description: 'Add owner',
          edits: [
            {
              file: '/nonexistent/path/file.yaml',
              range: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
              newText: 'owner: TODO\n',
            },
          ],
        },
      });

      const results = applyFixes([diag]);
      expect(results).toHaveLength(0);
    });

    it('handles insertion at the first line', () => {
      const yaml = 'kind: concept\nid: test\n';
      const filePath = writeTmp('first-line.yaml', yaml);

      const diag = makeDiagnostic({
        source: { file: filePath, line: 1, col: 1 },
        fix: {
          description: 'Add id field',
          edits: [
            {
              file: filePath,
              range: { startLine: 1, startCol: 1, endLine: 1, endCol: 1 },
              newText: '# header\n',
            },
          ],
        },
      });

      const results = applyFixes([diag]);
      expect(results).toHaveLength(1);
      expect(results[0]!.newContent.startsWith('# header')).toBe(true);
    });
  });
});
