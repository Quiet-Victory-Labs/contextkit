# OAuth Flow for RunContext MCP Connectors — Design

**Date:** 2026-03-09
**Status:** Approved

## Goal

Enable secure authentication with cloud database providers when RunContext MCP connectors (`@runcontext/db`, CLI) need to connect to cloud-deployed databases. Replace plaintext connection strings with provider-native OAuth/CLI auth flows.

## Principles

- We don't manage users' database credentials in the cloud — they manage their own databases
- We help them connect securely using OAuth/CLI flows their providers already support
- Existing `--url` and `connection:` config remain as escape hatches
- No native dependencies — shell out to OS tools for keychain and provider CLIs

## Architecture: Provider Plugin System

Each cloud database provider is a self-contained plugin implementing a standard interface. The core handles credential storage; the wizard and CLI call into plugins via a shared registry.

### Plugin Interface

```typescript
interface AuthProvider {
  id: string;                    // 'neon', 'aws-rds', 'azure-sql', etc.
  displayName: string;           // 'Neon', 'AWS RDS/Aurora', etc.
  adapters: AdapterType[];       // ['postgres'] or ['postgres', 'mysql'] for AWS

  // Step 1: Authenticate with the provider
  authenticate(): Promise<AuthResult>;

  // Step 2: List available databases (after auth)
  listDatabases(): Promise<DatabaseEntry[]>;

  // Step 3: Build a connection string for a selected database
  getConnectionString(db: DatabaseEntry): Promise<string>;

  // Check if provider CLI is installed and authenticated
  detectCli(): Promise<{ installed: boolean; authenticated: boolean }>;

  // Check if existing credentials are still valid
  validateCredentials(creds: StoredCredential): Promise<boolean>;
}
```

`authenticate()` tries two strategies in order:
1. Read existing CLI credentials — check if the provider's CLI is already authenticated
2. Fallback to OAuth/browser flow — launch provider's OAuth if CLI isn't available

### Provider Registry

A `Map<string, AuthProvider>` shared by CLI, wizard, and `@runcontext/db`.

## Credential Storage

Three-tier strategy, tried in order:

### 1. OS Keychain (primary)

- **macOS**: `security add-generic-password` / `find-generic-password`
- **Linux**: `secret-tool store` / `secret-tool lookup` (freedesktop secret-service)
- **Windows**: PowerShell `New-StoredCredential` / `Get-StoredCredential`
- Service name: `runcontext`, account key: `{provider}:{database-id}`
- No native dependencies — all via shell-out to OS-provided tools

### 2. `~/.runcontext/credentials.json` (fallback)

Used when keychain is unavailable (CI, Docker, headless SSH). File permissions `0o600`.

```json
{
  "cloud": { "token": "...", "org": "...", "apiUrl": "..." },
  "databases": {
    "neon:ep-red-rain-a4sny153": {
      "provider": "neon",
      "token": "...",
      "expiresAt": "2026-03-10T...",
      "database": "neondb",
      "project": "saber-alert-sandbox"
    },
    "aws-rds:us-east-1:my-instance": {
      "provider": "aws-rds",
      "region": "us-east-1",
      "instance": "my-instance",
      "iamRole": "arn:aws:iam::..."
    }
  }
}
```

### 3. Environment variables (explicit override)

`RUNCONTEXT_DB_URL` or provider-specific vars (`DATABASE_URL`, `POSTGRES_URL`, etc.) always take precedence. No storage needed.

### Token Refresh

Each provider plugin owns its refresh logic. When `validateCredentials()` returns false, the plugin either refreshes silently (if it has a refresh token) or prompts re-authentication. Short-lived tokens (AWS IAM, 15-min TTL) are generated on-demand, never stored.

## Auth Flow

```
User runs `context auth` or clicks "Connect Database" in wizard
  |
  +-- "Which provider?" -> picker showing all supported providers
  |
  +-- Provider plugin checks: is their CLI installed and authenticated?
  |   +-- YES -> "Found existing gcloud credentials. Use these?" -> skip to DB selection
  |   +-- NO  -> Launch provider's OAuth flow (browser opens, local callback server)
  |
  +-- "Which database?" -> plugin calls listDatabases(), shows picker
  |   +-- Or manual entry: "Paste your database host/identifier"
  |
  +-- Plugin builds connection string, tests with SELECT 1
  |   +-- SUCCESS -> store credential in keychain, save reference in config
  |   +-- FAIL    -> show error, offer retry
  |
  +-- Config updated:
        data_sources:
          default:
            adapter: postgres
            auth: neon:ep-red-rain-a4sny153
```

At runtime, `auth: neon:ep-red-rain-a4sny153` is resolved to a connection string in memory — never written to disk.

## Supported Providers

| Provider | CLI | Auth Mechanism | List DBs |
|----------|-----|---------------|----------|
| AWS RDS/Aurora/Redshift | `aws` | IAM auth tokens via `aws rds generate-db-auth-token` (on-demand, 15-min TTL) | `aws rds describe-db-instances` |
| Azure SQL/Cosmos | `az` | `az login` (browser SSO), `az account get-access-token` | `az sql server list` + `az sql db list` |
| Google Cloud SQL/BigQuery | `gcloud` | Application Default Credentials / `gcloud auth` | `gcloud sql instances list` / `bq ls` |
| Neon | `neonctl` | Neon OAuth (browser callback) or existing neonctl token | Neon API `GET /projects` |
| Supabase | `supabase` | `supabase login` or read existing token | Management API `GET /v1/projects` |
| Snowflake | `snowsql` | Browser-based SSO (`externalbrowser` authenticator) | `SHOW DATABASES` |
| Databricks | `databricks` | Databricks OAuth (M2M or U2M) or existing PAT | SQL Warehouses API |
| ClickHouse Cloud | (none) | ClickHouse Cloud API key (user provides, stored in keychain) | Cloud API `GET /v1/organizations/{id}/services` |
| PlanetScale | `pscale` | `pscale auth login` (browser) or existing token | PlanetScale API |
| CockroachDB Cloud | `ccloud` | `ccloud auth login` (browser) | CockroachDB Cloud API |
| MongoDB Atlas | `atlas` | `atlas auth login` (browser) | Atlas API `GET /groups/{id}/clusters` |

## Package Structure

```
packages/core/src/auth/
  +-- types.ts              # AuthProvider interface, StoredCredential, DatabaseEntry
  +-- registry.ts           # Provider registry (Map<string, AuthProvider>)
  +-- keychain.ts           # OS keychain read/write (mac/linux/windows)
  +-- credential-store.ts   # Orchestrates keychain -> file fallback
  +-- resolve.ts            # Resolves auth: reference -> connection string at runtime
  +-- providers/
      +-- aws-rds.ts
      +-- azure-sql.ts
      +-- gcp.ts
      +-- neon.ts
      +-- supabase.ts
      +-- snowflake.ts
      +-- databricks.ts
      +-- clickhouse.ts
      +-- planetscale.ts
      +-- cockroachdb.ts
      +-- mongodb.ts
```

## Integration Points

### CLI

New `context auth [provider]` command. No args = interactive provider picker. With arg = go straight to that provider's auth flow.

### Wizard (port 4040)

New "Connect Database" step in the setup wizard. Shows provider logos, handles OAuth redirect via the wizard's local server.

### `@runcontext/db`

New `--auth <provider:key>` flag alongside existing `--url`. At startup, resolves the credential and builds the connection string in memory.

### Config

`runcontext.config.yaml` gains a new `auth` field on data sources:

```yaml
data_sources:
  default:
    adapter: postgres
    auth: neon:ep-red-rain-a4sny153    # uses stored credential
  warehouse:
    adapter: snowflake
    auth: snowflake:my-account          # uses stored credential
  legacy:
    adapter: postgres
    connection: postgresql://...         # still works, no change
```

Both `auth` and `connection` are valid. `auth` is preferred; `connection` is the escape hatch.
