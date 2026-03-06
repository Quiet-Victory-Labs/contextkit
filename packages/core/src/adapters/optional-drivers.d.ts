// Type stubs for optional peer dependencies.
// These drivers are dynamically imported at runtime — users install only what they need.

declare module 'mysql2/promise' {
  const mod: any;
  export default mod;
  export function createPool(uri: string): any;
}

declare module 'mssql' {
  const mod: any;
  export default mod;
}

declare module 'snowflake-sdk' {
  const mod: any;
  export default mod;
}

declare module '@google-cloud/bigquery' {
  export class BigQuery {
    constructor(opts?: any);
    dataset(name: string): any;
    query(opts: any): Promise<any[]>;
  }
}

declare module '@clickhouse/client' {
  export function createClient(opts: any): any;
}

declare module '@databricks/sql' {
  const mod: any;
  export default mod;
}

declare module 'better-sqlite3' {
  const mod: any;
  export default mod;
}
