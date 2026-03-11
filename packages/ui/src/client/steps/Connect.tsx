import { signal } from '@preact/signals';
import { Button, Card, Input, InfoCard, ConceptTerm, Skeleton, useToast } from '@runcontext/uxd/react';
import { api } from '../api';
import { sources, currentStep } from '../state';
import { CONCEPTS } from '../concepts';

// --- Interfaces ---

interface Provider {
  id: string;
  displayName?: string;
  display_name?: string;
  cliInstalled?: boolean;
  cliAuthenticated?: boolean;
}

interface DetectedSource {
  name?: string;
  adapter?: string;
  origin?: string;
  host?: string;
  database?: string;
  metadata?: Record<string, unknown>;
}

interface Database {
  id?: string;
  name?: string;
  database?: string;
  adapter?: string;
  host?: string;
  region?: string;
  project?: string;
  metadata?: Record<string, unknown>;
}

// --- Provider mapping ---

const ADAPTER_TO_PROVIDER: Record<string, string | null> = {
  postgres: 'neon',
  mysql: 'planetscale',
  duckdb: null,
  sqlite: null,
  snowflake: 'snowflake',
  bigquery: 'gcp',
  clickhouse: 'clickhouse',
  databricks: 'databricks',
  mssql: 'azure-sql',
  mongodb: 'mongodb',
};

function providerFromOrigin(origin: string | undefined, adapter: string | undefined): string | null {
  if (!origin) return adapter ? (ADAPTER_TO_PROVIDER[adapter] ?? null) : null;
  const o = origin.toLowerCase();
  if (o.includes('neon')) return 'neon';
  if (o.includes('supabase')) return 'supabase';
  if (o.includes('planetscale')) return 'planetscale';
  if (o.includes('snowflake')) return 'snowflake';
  if (o.includes('bigquery') || o.includes('gcp')) return 'gcp';
  if (o.includes('clickhouse')) return 'clickhouse';
  if (o.includes('databricks')) return 'databricks';
  if (o.includes('azure')) return 'azure-sql';
  if (o.includes('mongodb') || o.includes('atlas')) return 'mongodb';
  return adapter ? (ADAPTER_TO_PROVIDER[adapter] ?? null) : null;
}

// --- Helpers ---

function formatRegion(region: string): string {
  if (!region) return '';
  // "aws-us-east-1" → "US East 1", "aws-eu-central-1" → "EU Central 1"
  return region
    .replace(/^aws-/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// --- Internal signals ---

const providers = signal<Provider[]>([]);
const detectedSources = signal<DetectedSource[]>([]);
const detectedProviderIds = signal<Set<string>>(new Set());
const databases = signal<Database[]>([]);
const selectedProvider = signal<string | null>(null);
const loading = signal(false);
const error = signal<string | null>(null);
const connUrl = signal('');
const connLoading = signal(false);
const connError = signal<string | null>(null);
const loaded = signal(false);
const providersLoading = signal(true);

// --- Sidebar status helper ---

function updateDbStatus(source: { name?: string; adapter?: string }) {
  const dot = document.getElementById('db-status-dot');
  const text = document.getElementById('db-status-text');
  if (dot) {
    dot.classList.remove('error');
    dot.classList.add('success');
  }
  if (text) {
    text.textContent = (source.name || source.adapter || 'database') + ' connected';
  }
}

// --- Data loading ---

async function loadProviders() {
  try {
    const data = await api<Provider[]>('GET', '/api/auth/providers');
    providers.value = data;
  } catch {
    // Providers not available
  } finally {
    providersLoading.value = false;
  }
}

async function loadSources() {
  try {
    const data = await api<{ sources: DetectedSource[] }>('GET', '/api/sources');
    const srcs = data.sources || [];
    detectedSources.value = srcs;

    // Compute detected provider IDs
    const ids = new Set<string>();
    for (const src of srcs) {
      const pid = providerFromOrigin(src.origin, src.adapter);
      if (pid) ids.add(pid);
    }
    detectedProviderIds.value = ids;
  } catch {
    // Sources not available
  } finally {
    providersLoading.value = false;
  }
}

// --- Actions ---

async function startOAuth(providerId: string, toast: (variant: string, message: string) => void) {
  loading.value = true;
  error.value = null;
  selectedProvider.value = providerId;
  try {
    const result = await api<{ ok: boolean; databases: Database[] }>('POST', '/api/auth/start', {
      provider: providerId,
    });
    if (result.databases) {
      databases.value = result.databases;
    }
  } catch (e: any) {
    error.value = e.message || 'OAuth failed';
    toast('error', e.message || 'OAuth failed');
  } finally {
    loading.value = false;
  }
}

async function selectDatabase(db: Database, toast: (variant: string, message: string) => void) {
  loading.value = true;
  error.value = null;
  try {
    const result = await api<{ ok: boolean; auth: any }>('POST', '/api/auth/select-db', {
      provider: selectedProvider.value,
      database: db,
    });
    if (result.ok) {
      const source = {
        name: db.name || db.database,
        adapter: db.adapter,
        host: db.host,
        database: db.database || db.name,
        metadata: db.metadata,
      };
      sources.value = [source, ...sources.value];
      updateDbStatus(source);
      databases.value = [];
      selectedProvider.value = null;
      toast('success', `Connected to ${source.name || source.database || 'database'}`);
      currentStep.value = 2;
    }
  } catch (e: any) {
    error.value = e.message || 'Failed to select database';
    toast('error', e.message || 'Failed to select database');
  } finally {
    loading.value = false;
  }
}

async function useLocalSource(src: DetectedSource, toast: (variant: string, message: string) => void) {
  const source = {
    name: src.name,
    adapter: src.adapter,
    host: src.host,
    database: src.database || src.name,
    metadata: src.metadata,
  };
  sources.value = [source, ...sources.value];
  updateDbStatus(source);
  toast('success', `Connected to ${source.name || source.database || 'database'}`);
  currentStep.value = 2;
}

async function connectManual(toast: (variant: string, message: string) => void) {
  const url = connUrl.value.trim();
  if (!url) return;
  connLoading.value = true;
  connError.value = null;
  try {
    const result = await api<{ source: any }>('POST', '/api/sources', { connection: url });
    if (result.source) {
      sources.value = [result.source, ...sources.value];
      updateDbStatus(result.source);
      connUrl.value = '';
      toast('success', `Connected to ${result.source.name || result.source.database || 'database'}`);
      currentStep.value = 2;
    }
  } catch (e: any) {
    connError.value = e.message || 'Connection failed';
    toast('error', e.message || 'Connection failed');
  } finally {
    connLoading.value = false;
  }
}

function backToProviders() {
  databases.value = [];
  selectedProvider.value = null;
  error.value = null;
}

// --- Component ---

export function Connect() {
  const { toast } = useToast();

  // Load data on first render
  if (!loaded.value) {
    loaded.value = true;
    loadProviders();
    loadSources();
  }

  // Database selection view
  if (databases.value.length > 0) {
    return (
      <div>
        <div class="oauth-result-header">
          <h2 class="connect-heading">Select a database</h2>
          <a href="#" class="muted" onClick={(e: Event) => { e.preventDefault(); backToProviders(); }}>
            &larr; Back to providers
          </a>
        </div>

        {error.value && <p class="field-error">{error.value}</p>}

        <div class="source-cards">
          {databases.value.map((db) => {
            const project = db.project || (db.metadata?.project as string) || '';
            const branch = (db.metadata?.branch as string) || '';
            const org = (db.metadata?.org as string) || '';
            const region = db.region || (db.metadata?.region as string) || '';
            const displayName = project || db.name || db.database || 'Database';
            const dbName = db.name || db.database || '';
            const regionLabel = formatRegion(region);

            return (
              <Card key={db.id || db.name} interactive>
                <div class="source-card db-card-rich">
                  <div class="db-card-header">
                    <div class="db-card-title">{displayName}</div>
                    {org && org !== 'Personal' && <span class="db-card-org">{org}</span>}
                  </div>
                  <div class="db-card-details">
                    {dbName && dbName !== project && (
                      <span class="db-card-detail">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>
                        {dbName}
                      </span>
                    )}
                    {branch && (
                      <span class="db-card-detail">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 01-9 9"/></svg>
                        {branch}
                      </span>
                    )}
                    {regionLabel && (
                      <span class="db-card-detail">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>
                        {regionLabel}
                      </span>
                    )}
                  </div>
                  <div class="db-card-host">{db.host}</div>
                  <Button
                    size="sm"
                    disabled={loading.value}
                    onClick={() => selectDatabase(db, toast)}
                  >
                    Use This
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // Provider grid view (default)
  const detected = detectedProviderIds.value;
  const localSources = detectedSources.value.filter(
    (s) => s.adapter === 'duckdb' || s.adapter === 'sqlite'
  );
  const detectedProviders = providers.value.filter((p) => detected.has(p.id));
  const otherProviders = providers.value.filter((p) => !detected.has(p.id));

  return (
    <div>
      {/* Loading overlay when OAuth/connection is in progress */}
      {loading.value && (
        <div class="connect-loading-overlay">
          <div class="connect-loading-card">
            <div class="connect-loading-spinner" />
            <h3>Authenticating with {selectedProvider.value || 'provider'}...</h3>
            <p class="muted">Complete sign-in in the browser tab that just opened, then return here.</p>
          </div>
        </div>
      )}
      <InfoCard title="Connect Your Data Source" storageKey="connect-step-info">
        RunContext builds a <ConceptTerm term="contextLayer" definition={CONCEPTS.contextLayer.definition}>{CONCEPTS.contextLayer.label}</ConceptTerm> by reading your database schema.
        Your data stays local — we only extract metadata, never the data itself.
      </InfoCard>

      <div class="trust-signal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-status-success)" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span class="trust-signal-text">Read-only access — your data never leaves this machine</span>
      </div>

      <h2 class="connect-heading">Connect a database</h2>
      <p class="connect-subheading">
        Choose a cloud provider, use a local file, or paste a connection string.
      </p>

      {error.value && <p class="field-error">{error.value}</p>}

      {detected.size > 0 && (
        <p class="detected-hint">
          We detected database configurations in your project.
        </p>
      )}

      {/* Skeleton loading state */}
      {providersLoading.value && (
        <div class="source-cards">
          <Skeleton height={80} />
          <Skeleton height={80} />
          <Skeleton height={80} />
        </div>
      )}

      {!providersLoading.value && (
        <>
          {/* Local file sources */}
          {localSources.length > 0 && (
            <div class="source-cards">
              {localSources.map((src) => (
                <Card key={src.name || src.database} interactive>
                  <div class="source-card source-card-local">
                    <span class="source-card-badge">{src.adapter}</span>
                    <div class="source-card-name">{src.name || src.database}</div>
                    {src.host && <div class="source-card-host">{src.host}</div>}
                    <Button size="sm" onClick={() => useLocalSource(src, toast)}>
                      Use This
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Detected provider cards */}
          {detectedProviders.length > 0 && (
            <div class="source-cards">
              {detectedProviders.map((p) => (
                <Card key={p.id} interactive>
                  <div class="source-card source-card-detected">
                    <span class="source-card-badge">detected</span>
                    <div class="source-card-name">
                      {p.displayName || p.display_name || p.id}
                    </div>
                    <Button
                      size="sm"
                      disabled={loading.value}
                      onClick={() => startOAuth(p.id, toast)}
                    >
                      {loading.value && selectedProvider.value === p.id
                        ? 'Connecting...'
                        : 'Connect'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {(localSources.length > 0 || detectedProviders.length > 0) &&
            otherProviders.length > 0 && <div class="section-divider" />}

          {/* Other providers */}
          {otherProviders.length > 0 && (
            <div class="platform-grid">
              {otherProviders.map((p) => (
                <button
                  key={p.id}
                  class="platform-btn"
                  disabled={loading.value}
                  onClick={() => startOAuth(p.id, toast)}
                >
                  {p.displayName || p.display_name || p.id}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* Manual connection */}
      <div class="manual-connect">
        <label class="label-uppercase">Or paste a connection string</label>
        <div class="manual-connect-row">
          <Input
            placeholder="postgres://user:pass@host:5432/dbname"
            value={connUrl.value}
            onInput={(e: Event) => {
              connUrl.value = (e.target as HTMLInputElement).value;
            }}
            error={!!connError.value}
            disabled={connLoading.value}
          />
          <Button
            variant="secondary"
            disabled={connLoading.value || !connUrl.value.trim()}
            onClick={() => connectManual(toast)}
          >
            {connLoading.value ? 'Connecting...' : 'Connect'}
          </Button>
        </div>
        {connError.value && <p class="field-error">{connError.value}</p>}
      </div>
    </div>
  );
}
