import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

const DATABRICKS_CFG_PATH = path.join(os.homedir(), '.databrickscfg');

export class DatabricksProvider implements AuthProvider {
  id = 'databricks' as const;
  displayName = 'Databricks';
  adapters = ['databricks' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('databricks', ['--version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    try {
      if (fs.existsSync(DATABRICKS_CFG_PATH)) {
        const config = fs.readFileSync(DATABRICKS_CFG_PATH, 'utf-8');
        const hasToken = config.includes('token') || config.includes('host');
        return { installed: true, authenticated: hasToken };
      }
    } catch { /* ignore */ }

    return { installed: true, authenticated: false };
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Read existing databricks config (PAT or OAuth)
    try {
      if (fs.existsSync(DATABRICKS_CFG_PATH)) {
        const config = fs.readFileSync(DATABRICKS_CFG_PATH, 'utf-8');
        const tokenMatch = config.match(/token\s*=\s*(.+)/);
        if (tokenMatch?.[1]) {
          return { ok: true, provider: 'databricks', token: tokenMatch[1].trim() };
        }
      }
    } catch { /* fall through */ }

    // Strategy 2: Try databricks auth login
    try {
      await execFile('databricks', ['auth', 'login']);
      if (fs.existsSync(DATABRICKS_CFG_PATH)) {
        const config = fs.readFileSync(DATABRICKS_CFG_PATH, 'utf-8');
        const tokenMatch = config.match(/token\s*=\s*(.+)/);
        if (tokenMatch?.[1]) {
          return { ok: true, provider: 'databricks', token: tokenMatch[1].trim() };
        }
      }
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }

    return { ok: false, error: 'Failed to authenticate with Databricks' };
  }

  async listDatabases(_token?: string): Promise<DatabaseEntry[]> {
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const host = db.host ?? '';
    const token = (db.metadata?.token as string) ?? '';
    const httpPath = (db.metadata?.httpPath as string) ?? '';
    return `databricks://token:${encodeURIComponent(token)}@${host}:443${httpPath}`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;
    return false;
  }
}
