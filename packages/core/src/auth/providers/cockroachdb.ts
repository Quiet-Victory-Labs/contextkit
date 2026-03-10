import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

export class CockroachDbProvider implements AuthProvider {
  id = 'cockroachdb' as const;
  displayName = 'CockroachDB';
  adapters = ['postgres' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('ccloud', ['version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    try {
      await execFile('ccloud', ['auth', 'whoami']);
      return { installed: true, authenticated: true };
    } catch {
      return { installed: true, authenticated: false };
    }
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Check if already authenticated via ccloud
    try {
      const { stdout } = await execFile('ccloud', ['auth', 'whoami']);
      if (stdout.trim()) {
        return { ok: true, provider: 'cockroachdb', token: stdout.trim() };
      }
    } catch { /* fall through */ }

    // Strategy 2: Try ccloud auth login
    try {
      await execFile('ccloud', ['auth', 'login']);
      const { stdout } = await execFile('ccloud', ['auth', 'whoami']);
      return { ok: true, provider: 'cockroachdb', token: stdout.trim() };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async listDatabases(_token?: string): Promise<DatabaseEntry[]> {
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const user = (db.metadata?.user as string) ?? 'root';
    const token = (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const port = db.port ?? 26257;
    const dbName = db.name ?? 'defaultdb';
    return `postgresql://${user}:${encodeURIComponent(token)}@${host}:${port}/${dbName}?sslmode=require`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;
    return false;
  }
}
