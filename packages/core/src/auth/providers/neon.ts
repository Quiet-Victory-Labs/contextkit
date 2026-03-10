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
const NEON_CREDS_PATH = path.join(os.homedir(), '.config', 'neonctl', 'credentials.json');

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

    // Check for stored credentials (neonctl uses access_token)
    try {
      if (fs.existsSync(NEON_CREDS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(NEON_CREDS_PATH, 'utf-8'));
        return { installed: true, authenticated: !!(creds.access_token || creds.token) };
      }
    } catch { /* ignore */ }

    return { installed: true, authenticated: false };
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Read existing neonctl credentials — validate before trusting
    try {
      if (fs.existsSync(NEON_CREDS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(NEON_CREDS_PATH, 'utf-8'));
        const token = creds.access_token || creds.token;
        if (token) {
          const valid = await this.isTokenValid(token);
          if (valid) {
            return { ok: true, provider: 'neon', token };
          }
        }
      }
    } catch { /* fall through */ }

    // Strategy 2: Try neonctl auth command (opens browser for OAuth)
    try {
      await execFile('neonctl', ['auth'], { timeout: 120_000 });
      const creds = JSON.parse(fs.readFileSync(NEON_CREDS_PATH, 'utf-8'));
      const token = creds.access_token || creds.token;
      if (token) {
        return { ok: true, provider: 'neon', token };
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

  async listDatabases(authToken?: string): Promise<DatabaseEntry[]> {
    // Use provided token or fall back to stored credentials
    let token = authToken;
    if (!token) {
      try {
        if (fs.existsSync(NEON_CREDS_PATH)) {
          const creds = JSON.parse(fs.readFileSync(NEON_CREDS_PATH, 'utf-8'));
          token = creds.access_token || creds.token;
        }
      } catch { /* ignore */ }
    }
    if (!token) return [];

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Collect projects from personal account + all organizations
      interface NeonProject { id: string; name: string; region_id?: string; org_id?: string; org_name?: string; created_at?: string }
      const allProjects: NeonProject[] = [];

      // Personal projects
      const projRes = await fetch(`${NEON_API}/projects`, { headers });
      if (projRes.ok) {
        const projData = await projRes.json() as { projects: NeonProject[] };
        allProjects.push(...projData.projects);
      }

      // Organization projects
      try {
        const orgRes = await fetch(`${NEON_API}/users/me/organizations`, { headers });
        if (orgRes.ok) {
          const orgData = await orgRes.json() as { organizations: Array<{ id: string; name: string }> };
          for (const org of orgData.organizations) {
            const orgProjRes = await fetch(`${NEON_API}/projects?org_id=${org.id}`, { headers });
            if (orgProjRes.ok) {
              const orgProjData = await orgProjRes.json() as { projects: NeonProject[] };
              // Deduplicate (personal projects may overlap with org projects)
              for (const p of orgProjData.projects) {
                if (!allProjects.some((e) => e.id === p.id)) {
                  p.org_id = org.id;
                  p.org_name = org.name;
                  allProjects.push(p);
                }
              }
            }
          }
        }
      } catch { /* org listing is best-effort */ }

      const entries: DatabaseEntry[] = [];
      for (const proj of allProjects) {
        try {
          // Get branches (databases are per-branch in Neon API)
          const brRes = await fetch(`${NEON_API}/projects/${proj.id}/branches`, { headers });
          if (!brRes.ok) continue;
          const brData = await brRes.json() as {
            branches: Array<{ id: string; name: string }>;
          };

          // Get endpoints for connection hosts
          const epRes = await fetch(`${NEON_API}/projects/${proj.id}/endpoints`, { headers });
          const epData = epRes.ok
            ? (await epRes.json() as { endpoints: Array<{ host: string; branch_id: string }> })
            : { endpoints: [] };

          for (const branch of brData.branches) {
            // List databases in each branch
            const dbRes = await fetch(
              `${NEON_API}/projects/${proj.id}/branches/${branch.id}/databases`,
              { headers },
            );
            if (!dbRes.ok) continue;
            const dbData = await dbRes.json() as {
              databases: Array<{ id: number; name: string; owner_name: string; branch_id: string }>;
            };

            const endpoint = epData.endpoints.find((e) => e.branch_id === branch.id);
            for (const db of dbData.databases) {
              // Friendly region label (e.g. "aws-us-east-1" → "US East 1")
              const region = proj.region_id ?? '';
              entries.push({
                id: `${proj.id}:${branch.id}:${db.name}`,
                name: db.name,
                host: endpoint?.host ?? '',
                adapter: 'postgres',
                region,
                project: proj.name,
                metadata: {
                  project: proj.name,
                  projectId: proj.id,
                  branch: branch.name,
                  branchId: branch.id,
                  user: db.owner_name,
                  region,
                  org: proj.org_name || 'Personal',
                  token,
                },
              });
            }
          }
        } catch { /* skip project on error */ }
      }
      return entries;
    } catch {
      return [];
    }
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    // Prefer neonctl to get the real connection string (includes actual DB password)
    const projectId = (db.metadata?.projectId as string) ?? '';
    if (projectId) {
      try {
        const { stdout } = await execFile('neonctl', [
          'connection-string',
          '--project-id', projectId,
          '--database-name', db.name || 'neondb',
        ]);
        const connStr = stdout.trim();
        if (connStr.startsWith('postgres')) return connStr;
      } catch { /* fall through to manual build */ }
    }

    // Fallback: build manually (requires password in metadata)
    const user = (db.metadata?.user as string) ?? 'neondb_owner';
    const password = (db.metadata?.password as string) ?? (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const dbName = db.name ?? 'neondb';
    return `postgresql://${user}:${encodeURIComponent(password)}@${host}/${dbName}?sslmode=require`;
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

  private async isTokenValid(token: string): Promise<boolean> {
    try {
      const res = await fetch(`${NEON_API}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

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
