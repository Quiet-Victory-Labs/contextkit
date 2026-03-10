import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

export class AwsRdsProvider implements AuthProvider {
  id = 'aws-rds' as const;
  displayName = 'AWS RDS / Aurora';
  adapters = ['postgres' as const, 'mysql' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('aws', ['--version']);
    } catch {
      return { installed: false, authenticated: false };
    }
    try {
      await execFile('aws', ['sts', 'get-caller-identity']);
      return { installed: true, authenticated: true };
    } catch {
      return { installed: true, authenticated: false };
    }
  }

  async authenticate(): Promise<AuthResult> {
    try {
      const { stdout } = await execFile('aws', ['sts', 'get-caller-identity']);
      const identity = JSON.parse(stdout);
      return {
        ok: true,
        provider: 'aws-rds',
        token: identity.Arn,
      };
    } catch { /* fall through */ }

    try {
      await execFile('aws', ['sso', 'login']);
      const { stdout } = await execFile('aws', ['sts', 'get-caller-identity']);
      const identity = JSON.parse(stdout);
      return { ok: true, provider: 'aws-rds', token: identity.Arn };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async listDatabases(): Promise<DatabaseEntry[]> {
    try {
      const { stdout } = await execFile('aws', [
        'rds', 'describe-db-instances',
        '--query', 'DBInstances[].{id:DBInstanceIdentifier,host:Endpoint.Address,port:Endpoint.Port,engine:Engine}',
        '--output', 'json',
      ]);
      const instances = JSON.parse(stdout) as Array<{
        id: string; host: string; port: number; engine: string;
      }>;
      return instances.map((i) => ({
        id: i.id,
        name: i.id,
        host: i.host,
        port: i.port,
        adapter: i.engine.includes('mysql') ? 'mysql' as const : 'postgres' as const,
        metadata: { engine: i.engine },
      }));
    } catch {
      return [];
    }
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const user = (db.metadata?.user as string) ?? 'admin';
    const token = (db.metadata?.token as string) ?? '';
    const host = db.host ?? '';
    const port = db.port ?? 5432;
    const dbName = db.name ?? '';
    const proto = db.adapter === 'mysql' ? 'mysql' : 'postgresql';
    return `${proto}://${user}:${encodeURIComponent(token)}@${host}:${port}/${dbName}?sslmode=require`;
  }

  async validateCredentials(_creds: StoredCredential): Promise<boolean> {
    // IAM auth tokens are generated on-demand (15-min TTL) — never stored as valid
    return false;
  }
}
