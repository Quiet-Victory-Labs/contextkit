import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { DataAdapter, AdapterType } from '@runcontext/core';
import { createAdapter } from '@runcontext/core';

import { enforceReadOnly, applyTimeout, DEFAULT_TIMEOUT_MS } from './guardrails.js';
import { listSchemas, listTables, describeTable, sampleValues, listRelationships, executeQuery } from './tools.js';

/**
 * Detect the adapter type from a connection URL.
 */
export function detectAdapter(url: string): AdapterType {
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'postgres';
  if (url.startsWith('mysql://')) return 'mysql';
  if (url.startsWith('mssql://') || url.startsWith('sqlserver://')) return 'mssql';
  if (url.startsWith('clickhouse://')) return 'clickhouse';
  if (url.endsWith('.duckdb') || url.endsWith('.db') || url.startsWith('duckdb://')) return 'duckdb';
  if (url.endsWith('.sqlite') || url.endsWith('.sqlite3') || url.startsWith('sqlite://')) return 'sqlite';
  if (url.includes('snowflake')) return 'snowflake';
  if (url.includes('bigquery')) return 'bigquery';
  if (url.includes('databricks')) return 'databricks';

  throw new Error(`Cannot detect adapter from URL: ${url}. Please provide a recognizable connection string.`);
}

/**
 * Build a DataSourceConfig from a URL string and detected adapter type.
 */
function buildConfig(url: string, adapterType: AdapterType) {
  switch (adapterType) {
    case 'postgres':
    case 'mysql':
    case 'mssql':
      return { adapter: adapterType, connection: url };
    case 'duckdb':
      return { adapter: 'duckdb' as const, path: url.replace(/^duckdb:\/\//, '') };
    case 'sqlite':
      return { adapter: 'sqlite' as const, path: url.replace(/^sqlite:\/\//, '') };
    default:
      // For other adapters, pass connection as a generic config
      return { adapter: adapterType, connection: url };
  }
}

/**
 * Create and configure the MCP server with all db tools registered.
 */
export function createDbServer(adapter: DataAdapter, adapterType: AdapterType): McpServer {
  const server = new McpServer({
    name: 'runcontext-db',
    version: '0.5.2',
  });

  // --- db_list_schemas ---
  server.tool(
    'db_list_schemas',
    'List all schemas (databases/namespaces) available in the connected database',
    {},
    async () => {
      const result = await listSchemas(adapter, adapterType);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- db_list_tables ---
  server.tool(
    'db_list_tables',
    'List all tables and views with row counts, types, and schema information',
    {},
    async () => {
      const result = await listTables(adapter);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- db_describe_table ---
  server.tool(
    'db_describe_table',
    'Describe a table\'s columns including data types, nullability, and primary keys',
    {
      table: z.string().describe('Table name to describe (e.g. "users" or "public.users")'),
    },
    async ({ table }) => {
      const result = await describeTable(adapter, table);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- db_sample_values ---
  server.tool(
    'db_sample_values',
    'Sample rows from a table (max 100 rows). Read-only, with automatic row limit guardrails.',
    {
      table: z.string().describe('Table name to sample from'),
      limit: z.number().int().min(1).max(100).optional().describe('Number of rows to return (default 100, max 100)'),
    },
    async ({ table, limit }) => {
      const result = await sampleValues(adapter, table, limit);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- db_relationships ---
  server.tool(
    'db_relationships',
    'List foreign key relationships. Optionally filter by a specific table.',
    {
      table: z.string().optional().describe('Optional table name to filter relationships for'),
    },
    async ({ table }) => {
      const result = await listRelationships(adapter, adapterType, table);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    },
  );

  // --- db_query ---
  server.tool(
    'db_query',
    'Execute a read-only SQL query. Only SELECT statements are allowed. Automatically enforces row limits and timeouts.',
    {
      sql: z.string().describe('SQL query to execute (SELECT only)'),
      limit: z.number().int().min(1).max(1000).optional().describe('Maximum rows to return (default 100, max 1000)'),
    },
    async ({ sql, limit }) => {
      try {
        const result = await executeQuery(adapter, sql, limit);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
          isError: true,
        };
      }
    },
  );

  return server;
}

/**
 * Connect to the database, apply guardrails, and start the MCP server over stdio.
 */
export async function startServer(url: string): Promise<McpServer> {
  const adapterType = detectAdapter(url);
  const config = buildConfig(url, adapterType);
  const adapter = await createAdapter(config);

  // Connect to the database
  await adapter.connect();

  // Apply read-only guardrail
  const readOnlySql = enforceReadOnly(adapterType);
  if (readOnlySql) {
    try {
      await adapter.query(readOnlySql);
    } catch {
      // Some adapters may not support this; continue
      console.error(`Warning: Could not set read-only mode for ${adapterType}`);
    }
  }

  // Apply timeout guardrail
  const timeoutSql = applyTimeout(adapterType, DEFAULT_TIMEOUT_MS);
  if (timeoutSql) {
    try {
      await adapter.query(timeoutSql);
    } catch {
      console.error(`Warning: Could not set query timeout for ${adapterType}`);
    }
  }

  const server = createDbServer(adapter, adapterType);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Cleanup on exit
  process.on('SIGINT', async () => {
    await adapter.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await adapter.disconnect();
    process.exit(0);
  });

  return server;
}
