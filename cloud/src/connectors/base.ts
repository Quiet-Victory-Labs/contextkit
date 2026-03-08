/**
 * Connector Framework — Abstract Base Class
 *
 * Provides safety guardrails that every concrete connector inherits:
 *   • Query timeout enforcement (default 30 s)
 *   • Row limit enforcement   (default 10 000)
 *   • SQL allow-list           (SELECT, SHOW, DESCRIBE, EXPLAIN only)
 *   • Connection state tracking
 */

import type {
  ColumnMeta,
  ConnectorConfig,
  ReadOnlyConnector,
  RelationshipCandidate,
  TableMeta,
  TableStats,
} from './types.js';

// ── SQL allow-list ─────────────────────────────────────────────────

const ALLOWED_STATEMENT_PREFIXES = ['SELECT', 'SHOW', 'DESCRIBE', 'EXPLAIN'] as const;

/** Statements that could mutate data — rejected even if they appear inside a CTE. */
const FORBIDDEN_KEYWORDS = [
  'INSERT',
  'UPDATE',
  'DELETE',
  'DROP',
  'ALTER',
  'CREATE',
  'TRUNCATE',
  'GRANT',
  'REVOKE',
  'MERGE',
  'REPLACE',
  'CALL',
  'EXEC',
  'EXECUTE',
] as const;

// ── Errors ─────────────────────────────────────────────────────────

export class ConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectorError';
  }
}

export class QueryTimeoutError extends ConnectorError {
  constructor(timeoutMs: number) {
    super(`Query exceeded timeout of ${timeoutMs}ms`);
    this.name = 'QueryTimeoutError';
  }
}

export class UnsafeSqlError extends ConnectorError {
  constructor(reason: string) {
    super(`Unsafe SQL rejected: ${reason}`);
    this.name = 'UnsafeSqlError';
  }
}

export class ConnectionStateError extends ConnectorError {
  constructor(message: string) {
    super(message);
    this.name = 'ConnectionStateError';
  }
}

// ── Abstract base ──────────────────────────────────────────────────

export abstract class BaseConnector implements ReadOnlyConnector {
  protected connected = false;
  protected readonly queryTimeoutMs: number;
  protected readonly rowLimit: number;

  constructor(config: ConnectorConfig = {}) {
    this.queryTimeoutMs = config.query_timeout_ms ?? 30_000;
    this.rowLimit = config.row_limit ?? 10_000;
  }

  // ── Connection lifecycle ───────────────────────────────────────

  async connect(): Promise<void> {
    if (this.connected) return;
    await this.doConnect();
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.doDisconnect();
    this.connected = false;
  }

  /** Subclasses implement the actual connection logic. */
  protected abstract doConnect(): Promise<void>;
  /** Subclasses implement the actual disconnection logic. */
  protected abstract doDisconnect(): Promise<void>;

  // ── Abstract introspection methods ─────────────────────────────

  abstract listSchemas(): Promise<string[]>;
  abstract listTables(schema?: string): Promise<TableMeta[]>;
  abstract describeTable(schema: string, table: string): Promise<ColumnMeta[]>;
  abstract getTableStats(schema: string, table: string): Promise<TableStats>;
  abstract getViewDefinition(schema: string, view: string): Promise<string | null>;
  abstract detectRelationships(schema?: string): Promise<RelationshipCandidate[]>;

  // ── Safety guardrails ──────────────────────────────────────────

  /** Ensure the connector is connected before running queries. */
  protected assertConnected(): void {
    if (!this.connected) {
      throw new ConnectionStateError('Connector is not connected. Call connect() first.');
    }
  }

  /**
   * Validate that a SQL string is safe (read-only).
   *
   * Rules:
   *   1. Must begin with an allowed statement prefix.
   *   2. Must not contain forbidden mutation keywords as standalone words.
   */
  validateSql(sql: string): void {
    const trimmed = sql.trim();
    if (!trimmed) {
      throw new UnsafeSqlError('empty SQL statement');
    }

    const upper = trimmed.toUpperCase();

    // Rule 1 — must start with an allowed prefix
    const startsAllowed = ALLOWED_STATEMENT_PREFIXES.some((prefix) =>
      upper.startsWith(prefix),
    );
    if (!startsAllowed) {
      throw new UnsafeSqlError(
        `statement must begin with one of: ${ALLOWED_STATEMENT_PREFIXES.join(', ')}`,
      );
    }

    // Rule 2 — must not contain forbidden keywords as standalone words
    for (const keyword of FORBIDDEN_KEYWORDS) {
      // Word-boundary check: the keyword must not be part of a larger identifier
      const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
      if (pattern.test(trimmed)) {
        throw new UnsafeSqlError(`forbidden keyword detected: ${keyword}`);
      }
    }
  }

  /**
   * Append a row limit to a SQL query if it does not already have one.
   */
  applySqlRowLimit(sql: string): string {
    const upper = sql.trim().toUpperCase();
    if (upper.includes('LIMIT')) {
      return sql;
    }
    return `${sql.trim()} LIMIT ${this.rowLimit}`;
  }

  /**
   * Execute `fn` with an enforced timeout.
   * Rejects with QueryTimeoutError if the timeout is exceeded.
   */
  async withTimeout<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> {
    const ms = timeoutMs ?? this.queryTimeoutMs;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new QueryTimeoutError(ms));
      }, ms);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
