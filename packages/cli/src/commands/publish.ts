import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import { compile, loadConfig, emitManifest } from '@runcontext/core';
import { formatError } from '../formatters/pretty.js';

export const DEFAULT_API_URL = 'https://api.runcontext.dev';

export interface PublishOptions {
  org?: string;
  apiKey?: string;
  apiUrl?: string;
  contextDir?: string;
}

export interface PublishPayload {
  org: string;
  manifest: ReturnType<typeof emitManifest>;
  files: Array<{ path: string; content: string }>;
}

/**
 * Recursively collect all YAML files from a directory, returning
 * each as { path (relative), content }.
 */
export function collectYamlFiles(
  dir: string,
): Array<{ path: string; content: string }> {
  const results: Array<{ path: string; content: string }> = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const resolvedRoot = fs.realpathSync(dir);

  function walk(current: string) {
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      // Resolve symlinks and verify path stays within context dir
      let resolvedFull: string;
      try {
        resolvedFull = fs.realpathSync(fullPath);
      } catch {
        continue; // broken symlink — skip
      }
      if (resolvedFull !== resolvedRoot && !resolvedFull.startsWith(resolvedRoot + path.sep)) {
        continue; // symlink escapes context dir — skip
      }
      if (entry.isDirectory() || (fs.statSync(resolvedFull).isDirectory())) {
        walk(fullPath);
      } else if (/\.ya?ml$/i.test(entry.name)) {
        results.push({
          path: path.relative(resolvedRoot, fullPath),
          content: fs.readFileSync(resolvedFull, 'utf-8'),
        });
      }
    }
  }

  walk(resolvedRoot);
  return results;
}

/**
 * Resolve and validate publish options, filling in from environment variables.
 * Returns resolved values or throws with a descriptive message.
 */
export function resolvePublishOptions(opts: PublishOptions): {
  apiKey: string;
  org: string;
  apiUrl: string;
} {
  const apiKey = opts.apiKey || process.env.RUNCONTEXT_API_KEY;
  if (!apiKey) {
    throw new Error(
      'API key required. Pass --api-key or set RUNCONTEXT_API_KEY environment variable.',
    );
  }

  const org = opts.org || process.env.RUNCONTEXT_ORG;
  if (!org) {
    throw new Error(
      'Organization required. Pass --org or set RUNCONTEXT_ORG environment variable.',
    );
  }

  const apiUrl = opts.apiUrl || DEFAULT_API_URL;

  return { apiKey, org, apiUrl };
}

/**
 * Build the publish URL from an API base URL.
 */
export function buildPublishUrl(apiUrl: string): string {
  return `${apiUrl.replace(/\/+$/, '')}/api/publish`;
}

/**
 * Categorize a fetch/network error for user-friendly messaging.
 * Returns true if the error indicates the API is unreachable.
 */
export function isNetworkError(message: string): boolean {
  return (
    message.includes('fetch failed') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND')
  );
}

export const publishCommand = new Command('publish')
  .description('Publish your semantic plane to RunContext Cloud')
  .option('--org <org>', 'Organization name')
  .option('--api-key <key>', 'RunContext API key (or set RUNCONTEXT_API_KEY)')
  .option('--api-url <url>', 'RunContext Cloud API URL', DEFAULT_API_URL)
  .option('--context-dir <path>', 'Path to context directory')
  .action(async (opts: PublishOptions) => {
    console.warn(chalk.yellow('Warning: context publish is deprecated. Use git push with RunContext Cloud instead.'));
    console.warn(chalk.yellow('  Run: context cloud'));
    console.warn('');

    try {
      // Load config first (before credential validation)
      const config = loadConfig(process.cwd());
      const contextDir = opts.contextDir
        ? path.resolve(opts.contextDir)
        : path.resolve(config.context_dir);

      // Validate required options
      const { apiKey, org, apiUrl } = resolvePublishOptions(opts);

      // Step 1: Compile the semantic plane
      console.log(chalk.dim('Compiling semantic plane...'));
      const { graph, diagnostics } = await compile({
        contextDir,
        config,
        rootDir: process.cwd(),
      });

      const errors = diagnostics.filter((d) => d.severity === 'error');
      if (errors.length > 0) {
        console.error(
          chalk.red(`Compile failed with ${errors.length} error(s):`),
        );
        for (const e of errors) {
          console.error(chalk.red(`  - ${e.message} [${e.ruleId}]`));
        }
        process.exit(1);
      }

      // Step 2: Build manifest
      const manifest = emitManifest(graph, config);
      console.log(chalk.dim('Manifest compiled successfully.'));

      // Step 3: Collect YAML source files
      const yamlFiles = collectYamlFiles(contextDir);
      console.log(chalk.dim(`Collected ${yamlFiles.length} context file(s).`));

      // Step 4: Build payload and upload
      const payload: PublishPayload = {
        org,
        manifest,
        files: yamlFiles,
      };

      const publishUrl = buildPublishUrl(apiUrl);
      console.log(chalk.dim(`Publishing to ${publishUrl}...`));

      const response = await fetch(publishUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(
          `Publish failed (HTTP ${response.status}): ${body || response.statusText}`,
        );
      }

      const result = (await response.json()) as { version?: string; url?: string };
      const planeUrl =
        result.url || `https://plane.runcontext.dev/${org}`;

      console.log('');
      console.log(chalk.green('Published successfully!'));
      if (result.version) {
        console.log(chalk.dim(`  Version: ${result.version}`));
      }
      console.log(chalk.cyan(`  ${planeUrl}`));
    } catch (err) {
      const message = (err as Error).message;
      if (isNetworkError(message)) {
        console.error(
          formatError(
            'Could not reach RunContext Cloud. The API may not be available yet.',
          ),
        );
        console.error(chalk.dim(`  Details: ${message}`));
      } else {
        console.error(formatError(message));
      }
      process.exit(1);
    }
  });
