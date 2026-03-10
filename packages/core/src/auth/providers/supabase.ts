import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

const SUPABASE_TOKEN_PATH = path.join(os.homedir(), '.supabase', 'access-token');

export class SupabaseProvider implements AuthProvider {
  id = 'supabase' as const;
  displayName = 'Supabase';
  adapters = ['postgres' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('supabase', ['--version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    try {
      if (fs.existsSync(SUPABASE_TOKEN_PATH)) {
        const token = fs.readFileSync(SUPABASE_TOKEN_PATH, 'utf-8').trim();
        return { installed: true, authenticated: !!token };
      }
    } catch { /* ignore */ }

    return { installed: true, authenticated: false };
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Read existing access token
    try {
      if (fs.existsSync(SUPABASE_TOKEN_PATH)) {
        const token = fs.readFileSync(SUPABASE_TOKEN_PATH, 'utf-8').trim();
        if (token) {
          return { ok: true, provider: 'supabase', token };
        }
      }
    } catch { /* fall through */ }

    // Strategy 2: Try supabase login
    try {
      await execFile('supabase', ['login']);
      const token = fs.readFileSync(SUPABASE_TOKEN_PATH, 'utf-8').trim();
      if (token) {
        return { ok: true, provider: 'supabase', token };
      }
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }

    return { ok: false, error: 'Failed to authenticate with Supabase' };
  }

  async listDatabases(_token?: string): Promise<DatabaseEntry[]> {
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const user = (db.metadata?.user as string) ?? 'postgres';
    const token = (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const port = db.port ?? 5432;
    const dbName = db.name ?? 'postgres';
    return `postgresql://${user}:${encodeURIComponent(token)}@${host}:${port}/${dbName}?sslmode=require`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;
    return false;
  }
}
