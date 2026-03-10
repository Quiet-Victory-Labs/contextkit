import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

const AZURE_CREDS_PATH = path.join(os.homedir(), '.azure', 'accessTokens.json');

export class AzureSqlProvider implements AuthProvider {
  id = 'azure-sql' as const;
  displayName = 'Azure SQL';
  adapters = ['postgres' as const, 'mssql' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('az', ['--version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    try {
      if (fs.existsSync(AZURE_CREDS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(AZURE_CREDS_PATH, 'utf-8'));
        return { installed: true, authenticated: Array.isArray(creds) && creds.length > 0 };
      }
    } catch { /* ignore */ }

    try {
      await execFile('az', ['account', 'show']);
      return { installed: true, authenticated: true };
    } catch {
      return { installed: true, authenticated: false };
    }
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Read existing Azure AD tokens
    try {
      if (fs.existsSync(AZURE_CREDS_PATH)) {
        const creds = JSON.parse(fs.readFileSync(AZURE_CREDS_PATH, 'utf-8'));
        if (Array.isArray(creds) && creds.length > 0 && creds[0].accessToken) {
          return { ok: true, provider: 'azure-sql', token: creds[0].accessToken };
        }
      }
    } catch { /* fall through */ }

    // Strategy 2: Try az login
    try {
      await execFile('az', ['login']);
      const { stdout } = await execFile('az', [
        'account', 'get-access-token',
        '--resource', 'https://ossrdbms-aad.database.windows.net',
      ]);
      const result = JSON.parse(stdout);
      return { ok: true, provider: 'azure-sql', token: result.accessToken };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async listDatabases(): Promise<DatabaseEntry[]> {
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const user = (db.metadata?.user as string) ?? 'admin';
    const token = (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const port = db.port ?? (db.adapter === 'mssql' ? 1433 : 5432);
    const dbName = db.name ?? '';
    const proto = db.adapter === 'mssql' ? 'mssql' : 'postgresql';
    return `${proto}://${user}:${encodeURIComponent(token)}@${host}:${port}/${dbName}?sslmode=require`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;
    return false;
  }
}
