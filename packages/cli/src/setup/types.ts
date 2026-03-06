import type {
  DataAdapter,
  DataSourceConfig,
  TableInfo,
  ColumnInfo,
  ContextGraph,
  TierScore,
} from '@runcontext/core';

export type TargetTier = 'bronze' | 'silver' | 'gold';

export interface UserIntent {
  goals: string;
  metrics?: string;
  audience?: string;
}

export interface SetupContext {
  cwd: string;
  contextDir: string;
  dsConfig: DataSourceConfig;
  adapter: DataAdapter;
  tables: TableInfo[];
  columns: Record<string, ColumnInfo[]>;
  modelName: string;
  targetTier: TargetTier;
  intent?: UserIntent;
  graph?: ContextGraph;
  tierScore?: TierScore;
}

export interface StepResult {
  skipped: boolean;
  summary: string;
}
