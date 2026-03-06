/** Map adapter type to its npm driver package. */
const DRIVER_PACKAGES: Record<string, string> = {
  duckdb: 'duckdb',
  postgres: 'pg',
  mysql: 'mysql2',
  mssql: 'mssql',
  snowflake: 'snowflake-sdk',
  bigquery: '@google-cloud/bigquery',
  clickhouse: '@clickhouse/client',
  databricks: '@databricks/sql',
  sqlite: 'better-sqlite3',
};

/** Error thrown when a database driver is not installed. */
export class MissingDriverError extends Error {
  public readonly adapter: string;
  public readonly driverPackage: string;

  constructor(adapter: string) {
    const pkg = DRIVER_PACKAGES[adapter] ?? adapter;
    super(`Missing database driver: "${pkg}" is required for the ${adapter} adapter.\n\nInstall it with:\n  npm install ${pkg}`);
    this.name = 'MissingDriverError';
    this.adapter = adapter;
    this.driverPackage = pkg;
  }
}

/** Get the npm package name for a given adapter type. */
export function getDriverPackage(adapter: string): string | undefined {
  return DRIVER_PACKAGES[adapter];
}
