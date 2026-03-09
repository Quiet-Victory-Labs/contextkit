import { Command } from 'commander';
import chalk from 'chalk';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { formatError, formatSuccess } from '../formatters/pretty.js';

const DEFAULT_CLOUD_URL = 'https://app.runcontext.dev';
const DEFAULT_API_URL = 'https://api.runcontext.dev';

export interface CloudCredentials {
  token: string;
  org: string;
  apiUrl: string;
}

/**
 * Return the path to the credentials file (~/.runcontext/credentials.json).
 */
export function credentialsPath(): string {
  return path.join(os.homedir(), '.runcontext', 'credentials.json');
}

/**
 * Load stored credentials, or return null if none exist.
 */
export function loadCredentials(): CloudCredentials | null {
  const filePath = credentialsPath();
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as CloudCredentials;
  } catch {
    return null;
  }
}

/**
 * Save credentials to ~/.runcontext/credentials.json.
 */
export function saveCredentials(creds: CloudCredentials): void {
  const filePath = credentialsPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(creds, null, 2) + '\n', 'utf-8');
  // Restrict file permissions (owner-only read/write)
  fs.chmodSync(filePath, 0o600);
}

/**
 * Open a URL in the user's default browser using execFile (no shell).
 */
function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  let cmd: string;
  let args: string[];

  if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  return new Promise((resolve, reject) => {
    execFile(cmd, args, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

/**
 * Start a temporary local HTTP server, open the browser for OAuth,
 * and wait for the auth callback. Returns the token string.
 */
export function waitForAuthCallback(
  cloudUrl: string,
  signal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        });
        res.end();
        return;
      }

      if (req.method !== 'POST' || req.url !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      let body = '';
      req.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const data = JSON.parse(body) as { token?: string };
          if (!data.token) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Missing token' }));
            return;
          }

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(JSON.stringify({ ok: true }));

          server.close();
          resolve(data.token);
        } catch {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON' }));
        }
      });
    });

    if (signal) {
      signal.addEventListener('abort', () => {
        server.close();
        reject(new Error('Authentication timed out'));
      });
    }

    // Listen on a random available port
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Failed to start local auth server'));
        return;
      }

      const port = addr.port;
      const authUrl = `${cloudUrl}/cli-auth?port=${port}`;

      console.log(chalk.dim(`  Auth server listening on http://127.0.0.1:${port}`));
      console.log('');
      console.log(`Opening browser to: ${chalk.cyan(authUrl)}`);
      console.log(chalk.dim('  If the browser does not open, visit the URL above manually.'));
      console.log('');

      openBrowser(authUrl).catch(() => {
        // Silently ignore — user can open manually
      });
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Detect the Git remote origin URL using execFile (no shell).
 */
function detectGitRemote(): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['remote', 'get-url', 'origin'], (err, stdout) => {
      if (err) {
        resolve(null);
      } else {
        resolve(stdout.trim() || null);
      }
    });
  });
}

export const cloudInitCommand = new Command('cloud')
  .description('Connect your project to RunContext Cloud')
  .option('--cloud-url <url>', 'RunContext Cloud URL', DEFAULT_CLOUD_URL)
  .option('--api-url <url>', 'RunContext Cloud API URL', DEFAULT_API_URL)
  .action(async (opts: { cloudUrl: string; apiUrl: string }) => {
    try {
      console.log('');
      console.log(chalk.bold('RunContext Cloud Setup'));
      console.log(chalk.dim('Connect your semantic layer to RunContext Cloud for Git-driven sync.'));
      console.log('');

      // Check for existing credentials
      const existing = loadCredentials();
      if (existing) {
        console.log(chalk.yellow('Existing credentials found. Re-authenticating...'));
        console.log('');
      }

      // Step 1: Authenticate via browser OAuth flow
      console.log(chalk.dim('Step 1: Authenticate with RunContext Cloud'));

      const abortController = new AbortController();
      const timeout = setTimeout(() => abortController.abort(), 5 * 60 * 1000); // 5 minute timeout

      let token: string;
      try {
        token = await waitForAuthCallback(opts.cloudUrl, abortController.signal);
      } finally {
        clearTimeout(timeout);
      }

      console.log(formatSuccess('Authenticated successfully!'));
      console.log('');

      // Step 2: Fetch org info from the API
      console.log(chalk.dim('Step 2: Retrieving organization info...'));

      const orgResponse = await fetch(`${opts.apiUrl}/api/cli/orgs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let org: string;

      if (orgResponse.ok) {
        const orgData = (await orgResponse.json()) as {
          orgs?: Array<{ slug: string; name: string }>;
        };
        const orgs = orgData.orgs ?? [];

        if (orgs.length > 0) {
          org = orgs[0]!.slug;
          console.log(`  Organization: ${chalk.cyan(org)}`);
        } else {
          console.log(chalk.yellow('  No organizations found.'));
          console.log(`  Create one at ${chalk.cyan(`${opts.cloudUrl}/settings/org`)}`);
          console.log('  Then re-run: context cloud');
          process.exit(1);
        }
      } else {
        // API may not be fully available yet — store token and let user set org manually
        console.log(chalk.yellow('  Could not retrieve org info. You can set it later.'));
        org = 'default';
      }

      console.log('');

      // Step 3: Save credentials
      console.log(chalk.dim('Step 3: Saving credentials...'));
      saveCredentials({ token, org, apiUrl: opts.apiUrl });
      console.log(`  Saved to ${chalk.dim(credentialsPath())}`);
      console.log('');

      // Step 4: Register Git connection
      console.log(chalk.dim('Step 4: Connect your Git repository'));
      console.log('');
      console.log('  To enable Git-driven sync, push your context files to a GitHub repo:');
      console.log('');
      console.log(chalk.dim('    # If you already have a repo:'));
      console.log('    git add context/ runcontext.config.yaml');
      console.log('    git commit -m "Add semantic layer"');
      console.log('    git push');
      console.log('');
      console.log(chalk.dim('    # Then install the RunContext GitHub App:'));
      console.log(`    ${chalk.cyan(`${opts.cloudUrl}/settings/git`)}`);
      console.log('');

      // Try to register the connection if we can detect the git remote
      const remote = await detectGitRemote();
      if (remote) {
        console.log(`  Detected Git remote: ${chalk.dim(remote)}`);

        // Register with the API
        const registerResponse = await fetch(
          `${opts.apiUrl}/api/cli/connect-repo`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ org, repoUrl: remote }),
          },
        );

        if (registerResponse.ok) {
          console.log(formatSuccess('  Repository registered with RunContext Cloud!'));
        } else {
          console.log(
            chalk.dim('  Could not auto-register repo. Use the dashboard to connect it manually.'),
          );
        }
      }

      console.log('');
      console.log(chalk.green('Setup complete!'));
      console.log(
        `  Your semantic layer dashboard: ${chalk.cyan(`${opts.cloudUrl}/dashboard`)}`,
      );
      console.log('');
    } catch (err) {
      const message = (err as Error).message;
      if (message === 'Authentication timed out') {
        console.error(formatError('Authentication timed out. Please try again.'));
      } else {
        console.error(formatError(message));
      }
      process.exit(1);
    }
  });
