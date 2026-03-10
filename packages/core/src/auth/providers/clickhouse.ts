import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

/**
 * ClickHouse provider — no CLI tool; credentials are user-provided API keys.
 */
export class ClickHouseProvider implements AuthProvider {
  id = 'clickhouse' as const;
  displayName = 'ClickHouse';
  adapters = ['clickhouse' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    // ClickHouse has no CLI tool for auth; credentials are always user-provided
    return { installed: false, authenticated: false };
  }

  async authenticate(): Promise<AuthResult> {
    // ClickHouse uses user-provided API keys — no automatic auth flow
    return { ok: false, error: 'ClickHouse requires user-provided credentials (host, user, password)' };
  }

  async listDatabases(): Promise<DatabaseEntry[]> {
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const user = (db.metadata?.user as string) ?? 'default';
    const password = (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const port = db.port ?? 8443;
    const dbName = db.name ?? 'default';
    return `clickhouse://${user}:${encodeURIComponent(password)}@${host}:${port}/${dbName}?secure=true`;
  }

  async validateCredentials(creds: StoredCredential): Promise<boolean> {
    if (!creds.token) return false;
    if (creds.expiresAt && new Date(creds.expiresAt) < new Date()) return false;
    return false;
  }
}
