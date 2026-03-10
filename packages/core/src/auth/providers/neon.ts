import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as http from 'node:http';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

const NEON_API = 'https://console.neon.tech/api/v2';
const NEON_OAUTH_URL = 'https://console.neon.tech/oauth/authorize';
const NEON_CREDS_PATH = path.join(os.homedir(), '.neon', 'credentials.json');

export class NeonProvider implements AuthProvider {
  id = 'neon' as const;
  displayName = 'Neon';
  adapters = ['postgres' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('neonctl', ['--version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    // Check for stored credentials
    try {
      if (fs.existsSync(NEON_CREDS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(NEON_CREDS_PATH, 'utf-8'));
        return { installed: true, authenticated: !!creds.token };
      }
    } catch { /* ignore */ }

    return { installed: true, authenticated: false };
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Read existing neonctl credentials
    try {
      if (fs.existsSync(NEON_CREDS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(NEON_CREDS_PATH, 'utf-8'));
        if (creds.token) {
          return { ok: true, provider: 'neon', token: creds.token };
        }
      }
    } catch { /* fall through */ }

    // Strategy 2: Try neonctl auth command
    try {
      await execFile('neonctl', ['auth']);
      const creds = JSON.parse(fs.readFileSync(NEON_CREDS_PATH, 'utf-8'));
      if (creds.token) {
        return { ok: true, provider: 'neon', token: creds.token };
      }
    } catch { /* fall through */ }

    // Strategy 3: Direct Neon OAuth flow (browser callback)
    try {
      const token = await this.oauthFlow();
      return { ok: true, provider: 'neon', token };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async listDatabases(): Promise<DatabaseEntry[]> {
    // Requires a valid token — caller should authenticate first
    // This is a skeleton; the actual implementation calls Neon API
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const user = (db.metadata?.user as string) ?? 'neondb_owner';
    const token = (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const dbName = db.name ?? 'neondb';
    return `postgresql://${user}:${encodeURIComponent(token)}@${host}/${dbName}?sslmode=require`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;

    // Verify token against Neon API
    try {
      const res = await fetch(`${NEON_API}/projects`, {
        headers: { Authorization: `Bearer ${creds.token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  // -- Private --

  private openBrowser(url: string): void {
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    execFileCb(cmd, [url], () => { /* ignore errors */ });
  }

  private oauthFlow(): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        if (req.method !== 'GET' || !req.url?.startsWith('/callback')) {
          res.writeHead(404);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://localhost`);
        const token = url.searchParams.get('token');

        if (!token) {
          res.writeHead(400);
          res.end('Missing token');
          return;
        }

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<html><body><h1>Authenticated! You can close this tab.</h1></body></html>');
        server.close();
        resolve(token);
      });

      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (!addr || typeof addr === 'string') {
          server.close();
          reject(new Error('Failed to start OAuth callback server'));
          return;
        }
        const port = addr.port;
        const redirectUri = `http://127.0.0.1:${port}/callback`;
        const authUrl = `${NEON_OAUTH_URL}?redirect_uri=${encodeURIComponent(redirectUri)}`;
        this.openBrowser(authUrl);
      });

      server.on('error', reject);

      // Timeout after 2 minutes
      setTimeout(() => {
        server.close();
        reject(new Error('OAuth flow timed out'));
      }, 120_000);
    });
  }
}
