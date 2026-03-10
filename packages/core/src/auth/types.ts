import type { AdapterType } from '../adapters/types.js';

// ---------------------------------------------------------------------------
// Auth result
// ---------------------------------------------------------------------------

export type AuthResult =
  | { ok: true; provider: string; token: string; refreshToken?: string; expiresAt?: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Database entry (returned by listDatabases)
// ---------------------------------------------------------------------------

export interface DatabaseEntry {
  id: string;
  name: string;
  host?: string;
  port?: number;
  adapter: AdapterType;
  region?: string;
  project?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Stored credential
// ---------------------------------------------------------------------------

export interface StoredCredential {
  provider: string;
  key: string;           // e.g. "neon:ep-red-rain-a4sny153"
  token?: string;
  refreshToken?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Provider plugin interface
// ---------------------------------------------------------------------------

export interface AuthProvider {
  id: string;
  displayName: string;
  adapters: AdapterType[];

  /** Authenticate with the provider. Tries CLI credentials first, then OAuth. */
  authenticate(): Promise<AuthResult>;

  /** List available databases after authentication. */
  listDatabases(): Promise<DatabaseEntry[]>;

  /** Build a connection string for a selected database. */
  getConnectionString(db: DatabaseEntry): Promise<string>;

  /** Check if the provider's CLI is installed and authenticated. */
  detectCli(): Promise<{ installed: boolean; authenticated: boolean }>;

  /** Check if stored credentials are still valid. */
  validateCredentials(creds: StoredCredential): Promise<boolean>;
}
