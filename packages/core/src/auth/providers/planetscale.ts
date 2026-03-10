import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

const PSCALE_TOKEN_PATH = path.join(os.homedir(), '.config', 'planetscale', 'access-token');

export class PlanetScaleProvider implements AuthProvider {
  id = 'planetscale' as const;
  displayName = 'PlanetScale';
  adapters = ['mysql' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('pscale', ['version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    try {
      if (fs.existsSync(PSCALE_TOKEN_PATH)) {
        const token = fs.readFileSync(PSCALE_TOKEN_PATH, 'utf-8').trim();
        return { installed: true, authenticated: !!token };
      }
    } catch { /* ignore */ }

    return { installed: true, authenticated: false };
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Read existing OAuth token
    try {
      if (fs.existsSync(PSCALE_TOKEN_PATH)) {
        const token = fs.readFileSync(PSCALE_TOKEN_PATH, 'utf-8').trim();
        if (token) {
          return { ok: true, provider: 'planetscale', token };
        }
      }
    } catch { /* fall through */ }

    // Strategy 2: Try pscale auth login
    try {
      await execFile('pscale', ['auth', 'login']);
      const token = fs.readFileSync(PSCALE_TOKEN_PATH, 'utf-8').trim();
      if (token) {
        return { ok: true, provider: 'planetscale', token };
      }
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }

    return { ok: false, error: 'Failed to authenticate with PlanetScale' };
  }

  async listDatabases(): Promise<DatabaseEntry[]> {
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const user = (db.metadata?.user as string) ?? 'root';
    const token = (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const port = db.port ?? 3306;
    const dbName = db.name ?? '';
    return `mysql://${user}:${encodeURIComponent(token)}@${host}:${port}/${dbName}?sslmode=require`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;
    return false;
  }
}
