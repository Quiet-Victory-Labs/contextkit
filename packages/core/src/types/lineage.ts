export type LineageType = 'pipeline' | 'dashboard' | 'ml_model' | 'api' | 'manual' | 'file' | 'derived';

export interface UpstreamEntry {
  source: string;
  type: LineageType;
  pipeline?: string;
  tool?: string;
  refresh?: string;
  notes?: string;
}

export interface DownstreamEntry {
  target: string;
  type: LineageType;
  tool?: string;
  notes?: string;
}

export interface LineageFile {
  model: string;
  upstream?: UpstreamEntry[];
  downstream?: DownstreamEntry[];
}
