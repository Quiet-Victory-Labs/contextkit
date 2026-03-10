import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { AuthProvider, AuthResult, DatabaseEntry, StoredCredential } from '../types.js';

const execFile = promisify(execFileCb);

const SNOWSQL_CONFIG_PATH = path.join(os.homedir(), '.snowsql', 'config');

export class SnowflakeProvider implements AuthProvider {
  id = 'snowflake' as const;
  displayName = 'Snowflake';
  adapters = ['snowflake' as const];

  async detectCli(): Promise<{ installed: boolean; authenticated: boolean }> {
    try {
      await execFile('snowsql', ['--version']);
    } catch {
      return { installed: false, authenticated: false };
    }

    try {
      if (fs.existsSync(SNOWSQL_CONFIG_PATH)) {
        const config = fs.readFileSync(SNOWSQL_CONFIG_PATH, 'utf-8');
        const hasAccount = config.includes('accountname');
        return { installed: true, authenticated: hasAccount };
      }
    } catch { /* ignore */ }

    return { installed: true, authenticated: false };
  }

  async authenticate(): Promise<AuthResult> {
    // Strategy 1: Read existing snowsql config
    try {
      if (fs.existsSync(SNOWSQL_CONFIG_PATH)) {
        const config = fs.readFileSync(SNOWSQL_CONFIG_PATH, 'utf-8');
        if (config.includes('accountname')) {
          // Browser SSO tokens are obtained on-demand
          return { ok: true, provider: 'snowflake', token: 'browser-sso' };
        }
      }
    } catch { /* fall through */ }

    // Strategy 2: Prompt user to configure snowsql
    return { ok: false, error: 'Snowflake requires snowsql configuration. Run: snowsql -a <account>' };
  }

  async listDatabases(): Promise<DatabaseEntry[]> {
    return [];
  }

  async getConnectionString(db: DatabaseEntry): Promise<string> {
    const account = (db.metadata?.account as string) ?? '';
    const user = (db.metadata?.user as string) ?? '';
    const dbName = db.name ?? '';
    const warehouse = (db.metadata?.warehouse as string) ?? '';
    return `snowflake://${user}@${account}/${dbName}?warehouse=${warehouse}&authenticator=externalbrowser`;
  }

  async validateCredentials(_creds: StoredCredential): Promise<boolean> {
    // Browser SSO tokens are obtained on-demand
    return false;
  }
}
