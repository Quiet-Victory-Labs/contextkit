import { ProviderRegistry } from '../registry.js';
import { NeonProvider } from './neon.js';
import { AwsRdsProvider } from './aws-rds.js';
import { AzureSqlProvider } from './azure-sql.js';
import { GcpProvider } from './gcp.js';
import { SupabaseProvider } from './supabase.js';
import { SnowflakeProvider } from './snowflake.js';
import { DatabricksProvider } from './databricks.js';
import { ClickHouseProvider } from './clickhouse.js';
import { PlanetScaleProvider } from './planetscale.js';
import { CockroachDbProvider } from './cockroachdb.js';
import { MongoDbProvider } from './mongodb.js';

/** Create a registry with all built-in providers registered. */
export function createDefaultRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(new NeonProvider());
  registry.register(new AwsRdsProvider());
  registry.register(new AzureSqlProvider());
  registry.register(new GcpProvider());
  registry.register(new SupabaseProvider());
  registry.register(new SnowflakeProvider());
  registry.register(new DatabricksProvider());
  registry.register(new ClickHouseProvider());
  registry.register(new PlanetScaleProvider());
  registry.register(new CockroachDbProvider());
  registry.register(new MongoDbProvider());
  return registry;
}
