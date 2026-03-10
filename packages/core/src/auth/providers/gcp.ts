import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

const GCP_ADC_PATH = path.join(
  os.homedir(),
  '.config',
  'gcloud',
  'application_default_credentials.json',
);

export class GcpProvider implements AuthProvider {
  id = 'gcp' as const;
  displayName = 'Google Cloud SQL';
  adapters = ['postgres' as const, 'mysql' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('gcloud', ['--version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    try {
      if (fs.existsSync(GCP_ADC_PATH)) {
        return { installed: true, authenticated: true };
      }
    } catch { /* ignore */ }

    try {
      await execFile('gcloud', ['auth', 'print-access-token']);
      return { installed: true, authenticated: true };
    } catch {
      return { installed: true, authenticated: false };
    }
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Read existing Application Default Credentials
    try {
      if (fs.existsSync(GCP_ADC_PATH)) {
        const adc = JSON.parse(fs.readFileSync(GCP_ADC_PATH, 'utf-8'));
        if (adc.client_id) {
          const { stdout } = await execFile('gcloud', ['auth', 'print-access-token']);
          const token = stdout.trim();
          if (token) {
            return { ok: true, provider: 'gcp', token };
          }
        }
      }
    } catch { /* fall through */ }

    // Strategy 2: Try gcloud auth login
    try {
      await execFile('gcloud', ['auth', 'application-default', 'login']);
      const { stdout } = await execFile('gcloud', ['auth', 'print-access-token']);
      return { ok: true, provider: 'gcp', token: stdout.trim() };
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
    const port = db.port ?? (db.adapter === 'mysql' ? 3306 : 5432);
    const dbName = db.name ?? '';
    const proto = db.adapter === 'mysql' ? 'mysql' : 'postgresql';
    return `${proto}://${user}:${encodeURIComponent(token)}@${host}:${port}/${dbName}?sslmode=require`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;
    // GCP access tokens are short-lived; always re-validate
    return false;
  }
}
