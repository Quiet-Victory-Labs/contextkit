import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { generateSite } from '@runcontext/site';
import type { Manifest } from '@runcontext/core';

export const siteCommand = new Command('site')
  .description('Site generator commands');

siteCommand
  .command('build')
  .description('Build the context documentation site')
  .option('--manifest <path>', 'Path to manifest file', 'dist/context.manifest.json')
  .option('--output <dir>', 'Output directory', 'dist/site')
  .option('--title <title>', 'Site title')
  .option('--base-path <path>', 'Base path for links (e.g., /docs)')
  .action(async (opts: { manifest: string; output: string; title?: string; basePath?: string }) => {
    const manifestPath = resolve(opts.manifest);

    let manifestJson: string;
    try {
      manifestJson = await readFile(manifestPath, 'utf-8');
    } catch {
      console.error(`Error: Could not read manifest file at ${manifestPath}`);
      console.error('Run "context build" first to generate the manifest.');
      process.exitCode = 1;
      return;
    }

    let manifest: Manifest;
    try {
      manifest = JSON.parse(manifestJson) as Manifest;
    } catch {
      console.error(`Error: Invalid JSON in manifest file at ${manifestPath}`);
      process.exitCode = 1;
      return;
    }

    const outputDir = resolve(opts.output);

    console.log(`Building site from ${manifestPath}...`);

    await generateSite({
      manifest,
      outputDir,
      title: opts.title,
      basePath: opts.basePath,
    });

    console.log(`Site generated at ${outputDir}`);
  });
