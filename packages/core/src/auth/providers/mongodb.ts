import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

export class MongoDbProvider implements AuthProvider {
  id = 'mongodb' as const;
  displayName = 'MongoDB Atlas';
  adapters = ['mongodb' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('atlas', ['--version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    try {
      await execFile('atlas', ['auth', 'whoami']);
      return { installed: true, authenticated: true };
    } catch {
      return { installed: true, authenticated: false };
    }
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Check if already authenticated via atlas CLI
    try {
      const { stdout } = await execFile('atlas', ['auth', 'whoami']);
      if (stdout.trim()) {
        return { ok: true, provider: 'mongodb', token: stdout.trim() };
      }
    } catch { /* fall through */ }

    // Strategy 2: Try atlas auth login
    try {
      await execFile('atlas', ['auth', 'login']);
      const { stdout } = await execFile('atlas', ['auth', 'whoami']);
      return { ok: true, provider: 'mongodb', token: stdout.trim() };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async listDatabases(_token?: string): Promise<DatabaseEntry[]> {
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const user = (db.metadata?.user as string) ?? '';
    const token = (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const dbName = db.name ?? '';
    return `mongodb+srv://${user}:${encodeURIComponent(token)}@${host}/${dbName}?retryWrites=true&w=majority`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;
    return false;
  }
}
