import { parseDocument } from 'yaml';

/**
 * Apply an edit to a YAML string at the given dot-separated path.
 * Preserves comments and formatting via the `yaml` library's document model.
 *
 * Numeric path segments index into sequences (arrays).
 * If the path does not exist, it will be created.
 */
export function applyYamlEdit(
  yamlContent: string,
  dotPath: string,
  value: unknown,
): string {
  const doc = parseDocument(yamlContent);
  const segments = dotPath.split('.');

  // Handle '+' as array append
  if (segments[segments.length - 1] === '+') {
    const parentPath = segments.slice(0, -1).map((s) => (/^\d+$/.test(s) ? Number(s) : s));
    const parent = parentPath.length > 0 ? doc.getIn(parentPath) : doc.toJS();
    if (parent && typeof (parent as any).addIn === 'function') {
      // parent is a YAML node — use addIn
      (parent as any).add(doc.createNode(value));
    } else {
      // Parent doesn't exist or is not a sequence — create as array with the value
      doc.setIn(parentPath, [value]);
    }
    return doc.toString();
  }

  // setIn expects numeric segments as numbers for array indexing
  const path = segments.map((s) => (/^\d+$/.test(s) ? Number(s) : s));

  doc.setIn(path, value);

  return doc.toString();
}

/**
 * Preview a YAML edit without modifying the original content.
 * Returns the before/after strings and whether a change occurred.
 */
export function previewYamlEdit(
  yamlContent: string,
  dotPath: string,
  value: unknown,
): { before: string; after: string; changed: boolean } {
  const after = applyYamlEdit(yamlContent, dotPath, value);
  return {
    before: yamlContent,
    after,
    changed: after !== yamlContent,
  };
}
