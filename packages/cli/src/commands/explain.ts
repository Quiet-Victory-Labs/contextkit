import { Command } from 'commander';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import type { Manifest } from '@contextkit/core';

export const explainCommand = new Command('explain')
  .description('Look up a node by ID in the manifest')
  .argument('<id>', 'node ID to look up')
  .option('--manifest <path>', 'path to manifest file', 'dist/context.manifest.json')
  .action((id: string, opts: { manifest: string }) => {
    const manifestPath = path.resolve(process.cwd(), opts.manifest);

    if (!fs.existsSync(manifestPath)) {
      console.error(`Manifest not found at ${manifestPath}. Run 'context build' first.`);
      process.exit(1);
    }

    let manifest: Manifest;
    try {
      const raw = fs.readFileSync(manifestPath, 'utf-8');
      manifest = JSON.parse(raw) as Manifest;
    } catch {
      console.error(`Failed to read manifest at ${manifestPath}`);
      process.exit(1);
    }

    // Look up by index
    const entry = manifest.indexes?.byId?.[id];
    if (!entry) {
      console.error(`Node "${id}" not found in manifest.`);
      process.exit(1);
    }

    const { kind, index } = entry;
    const collection = (manifest as Record<string, unknown>)[kind + 's'] as Record<string, unknown>[];
    if (!collection || !collection[index]) {
      console.error(`Node "${id}" not found in "${kind}s" collection.`);
      process.exit(1);
    }

    const node = collection[index];

    // Display formatted info
    console.log(chalk.bold(`${kind}: ${id}`));
    console.log('');

    const fields: Array<[string, unknown]> = Object.entries(node).filter(
      ([key]) => key !== 'id',
    );

    for (const [key, value] of fields) {
      if (value === undefined || value === null) continue;

      if (Array.isArray(value)) {
        console.log(`  ${chalk.dim(key + ':')} ${value.join(', ')}`);
      } else if (typeof value === 'object') {
        console.log(`  ${chalk.dim(key + ':')} ${JSON.stringify(value)}`);
      } else {
        console.log(`  ${chalk.dim(key + ':')} ${String(value)}`);
      }
    }
  });
