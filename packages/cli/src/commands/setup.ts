import { Command } from 'commander';
import chalk from 'chalk';
import path from 'node:path';
import fs from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { loadConfig } from '@runcontext/core';
import { brand } from '../brand.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ensure the project has the minimum scaffolding for RunContext.
 * Creates runcontext.config.yaml, context/ dir, and AGENT_INSTRUCTIONS.md
 * if they don't already exist — so `npx @runcontext/cli setup` is a true
 * zero-to-running single command.
 */
function ensureProjectScaffolding(rootDir: string): void {
  // 0. package.json
  const pkgPath = path.join(rootDir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    const dirName = path.basename(rootDir);
    const pkg = {
      name: dirName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      version: '0.0.1',
      private: true,
      dependencies: {
        '@runcontext/cli': 'latest',
      },
    };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
    console.log(chalk.green(`  Created package.json`));
  }

  // 1. runcontext.config.yaml
  const configPath = path.join(rootDir, 'runcontext.config.yaml');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, `context_dir: context\noutput_dir: dist\nminimum_tier: bronze\n`, 'utf-8');
    console.log(chalk.green(`  Created runcontext.config.yaml`));
  }

  // 2. context/ directory
  const contextDir = path.join(rootDir, 'context');
  if (!fs.existsSync(contextDir)) {
    fs.mkdirSync(contextDir, { recursive: true });
    console.log(chalk.green(`  Created context/`));
  }

  // 3. AGENT_INSTRUCTIONS.md
  const agentPath = path.join(rootDir, 'AGENT_INSTRUCTIONS.md');
  if (!fs.existsSync(agentPath)) {
    // Look for bundled asset (works in published package and dev)
    const assetPath = path.resolve(__dirname, '..', 'assets', 'AGENT_INSTRUCTIONS.md');
    // Fallback: try from dist layout
    const altAssetPath = path.resolve(__dirname, '..', '..', 'assets', 'AGENT_INSTRUCTIONS.md');
    const sourcePath = fs.existsSync(assetPath) ? assetPath : fs.existsSync(altAssetPath) ? altAssetPath : null;

    if (sourcePath) {
      fs.copyFileSync(sourcePath, agentPath);
    } else {
      // Minimal fallback if asset not found
      fs.writeFileSync(agentPath, `# RunContext Agent Instructions\n\nSee https://github.com/RunContext/runcontext for full documentation.\n\n## On Session Start\n\n1. Run \`context tier\` to check the current metadata tier (Bronze/Silver/Gold)\n2. Report the current tier and list failing checks\n3. Ask the user what they'd like to work on\n\n## CLI Commands\n\n\`\`\`bash\ncontext tier                  # Check scorecard\ncontext verify --db <path>    # Validate against live data\ncontext fix --db <path>       # Auto-fix data warnings\ncontext setup                 # Interactive setup wizard\ncontext dev                   # Watch mode for live editing\n\`\`\`\n`, 'utf-8');
    }
    console.log(chalk.green(`  Created AGENT_INSTRUCTIONS.md`));
  }
}

/** Try to bind to a port. Returns true if available. */
function isPortFree(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(() => resolve(true)); });
    srv.listen(port, host);
  });
}

/** Find an available port starting from `start`, trying up to 10 ports. */
async function findAvailablePort(start: number, host: string): Promise<number> {
  for (let p = start; p < start + 10; p++) {
    if (await isPortFree(p, host)) return p;
  }
  return start; // fall back, let the server error naturally
}

export const setupCommand = new Command('setup')
  .description('Build a data product for your semantic plane')
  .option('--port <port>', 'Port for setup UI', '4040')
  .option('--host <host>', 'Host to bind', '127.0.0.1')
  .option('--no-browser', "Don't open browser automatically")
  .option('--session <id>', 'Bind to an existing wizard session')
  .option('--agent', 'Agent mode: create session, print ID, drive via CLI')
  .action(async (opts) => {
    const rootDir = process.cwd();

    console.log(chalk.cyan(`${brand.banner}\n`));

    // Ensure project scaffolding exists
    ensureProjectScaffolding(rootDir);

    const config = loadConfig(rootDir);
    const contextDir = path.resolve(config.context_dir);
    const requestedPort = parseInt(opts.port, 10);
    const port = await findAvailablePort(requestedPort, opts.host);

    if (port !== requestedPort) {
      console.log(chalk.yellow(`  Port ${requestedPort} in use, using ${port} instead`));
    }

    console.log(chalk.dim('\nStarting setup UI...'));

    const { startUIServer } = await import('@runcontext/ui');
    await startUIServer({
      rootDir,
      contextDir,
      port,
      host: opts.host,
    });

    const displayHost = (opts.host === '0.0.0.0' || opts.host === '::') ? '127.0.0.1' : opts.host;
    const url = `http://${displayHost}:${port}/setup`;
    console.log(chalk.green(`\n  Setup UI ready at ${url}\n`));

    if (opts.agent) {
      const res = await fetch(`http://127.0.0.1:${port}/api/session`, { method: 'POST' });
      const { sessionId } = (await res.json()) as { sessionId: string };
      console.log(chalk.green(`Session ID: ${sessionId}`));
    }

    if (opts.browser !== false) {
      if (process.platform === 'darwin') {
        execFile('open', [url], () => {});
      } else if (process.platform === 'win32') {
        execFile('cmd.exe', ['/c', 'start', '', url], () => {});
      } else {
        execFile('xdg-open', [url], () => {});
      }
    }
  });
