import { writeFileSync, mkdirSync } from 'node:fs';
import { colors } from '../src/tokens/colors.js';
import { typography } from '../src/tokens/typography.js';
import { spacing } from '../src/tokens/spacing.js';
import { radii } from '../src/tokens/radii.js';
import { shadows } from '../src/tokens/shadows.js';

function flattenObject(obj: Record<string, unknown>, prefix: string): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const varName = prefix ? `${prefix}-${kebab(key)}` : kebab(key);
    if (typeof value === 'object' && value !== null) {
      entries.push(...flattenObject(value as Record<string, unknown>, varName));
    } else {
      entries.push([varName, String(value)]);
    }
  }
  return entries;
}

function kebab(s: string): string {
  return s.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
}

const lines: string[] = ['/* Auto-generated from @runcontext/uxd tokens. Do not edit. */', '', ':root {'];

for (const [name, value] of flattenObject(colors, 'rc-color')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');
for (const [name, value] of flattenObject(typography.fontFamily, 'rc-font')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');
for (const [name, value] of flattenObject(typography.fontSize, 'rc-text')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');
for (const [name, value] of flattenObject(typography.fontWeight, 'rc-font-weight')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');
for (const [name, value] of flattenObject(typography.lineHeight, 'rc-leading')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');
for (const [key, value] of Object.entries(spacing)) {
  lines.push(`  --rc-space-${String(key).replace('.', '_')}: ${value};`);
}
lines.push('');
for (const [name, value] of flattenObject(radii, 'rc-radius')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('');
for (const [name, value] of flattenObject(shadows, 'rc-shadow')) {
  lines.push(`  --${name}: ${value};`);
}
lines.push('}');

mkdirSync('src/css', { recursive: true });
mkdirSync('dist/css', { recursive: true });
writeFileSync('src/css/tokens.css', lines.join('\n') + '\n');
console.log('Generated src/css/tokens.css');
