import { signal } from '@preact/signals';
import { Card, Skeleton, InfoCard, ConceptTerm, EmptyState, TierBadge, Badge, CodeBlock, Button, useToast } from '@runcontext/uxd/react';
import { api } from '../api';
import { CONCEPTS } from '../concepts';

interface Plane {
  name: string;
  description?: string;
  tier?: string;
  tables?: number;
  columns?: number;
}

interface FieldInfo {
  name: string;
  type: string;
  description: string;
  sampleValues: string[];
  semanticRole: string;
}

interface TableDetail {
  name: string;
  description: string;
  fields: FieldInfo[];
}

interface PlaneDetail {
  tables: TableDetail[];
  rules: {
    joinRules: any[];
    goldenQueries: any[];
    guardrails: any[];
    grainStatements: any[];
  };
  governance: any;
  glossary: any[];
  owners: any[];
  yaml: { model: string; rules: string; governance: string };
}

const planes = signal<Plane[]>([]);
const loading = signal(true);
const error = signal<string | null>(null);
const loaded = signal(false);
const selectedPlane = signal<string | null>(null);
const detail = signal<PlaneDetail | null>(null);
const detailLoading = signal(false);
const activeTab = signal<'overview' | 'tables' | 'rules' | 'governance' | 'yaml'>('overview');
const expandedTable = signal<string | null>(null);
const showCuratePanel = signal(false);
const curateMcpConfig = signal<string | null>(null);

const CURATION_PROMPT = `I have a RunContext semantic plane at Bronze tier. Please help me curate it to Gold.

Start by running \`context_tier\` to see the current scorecard, then work through each failing check:
1. Run small sample queries (LIMIT 10-25) to understand the actual data — never bulk export
2. Write meaningful descriptions, golden queries, guardrails, etc.
3. Re-run \`context_tier\` and iterate until Gold

Follow the agent instructions in AGENT_INSTRUCTIONS.md — never fabricate metadata, always query first. Never put PII in sample_values.`;

async function openCuratePanel() {
  showCuratePanel.value = true;
  if (!curateMcpConfig.value) {
    try {
      const data = await api<any>('GET', '/api/mcp-config');
      curateMcpConfig.value = JSON.stringify(data, null, 2);
    } catch { /* ignore */ }
  }
}

async function loadPlanes() {
  loading.value = true;
  error.value = null;
  try {
    const data = await api<Plane[]>('GET', '/api/products');
    planes.value = data;
  } catch (e: any) {
    error.value = e.message || 'Failed to load semantic planes';
  } finally {
    loading.value = false;
  }
}

async function selectPlane(name: string) {
  if (selectedPlane.value === name) {
    selectedPlane.value = null;
    return;
  }
  selectedPlane.value = name;
  activeTab.value = 'overview';
  expandedTable.value = null;
  detailLoading.value = true;
  try {
    const data = await api<PlaneDetail>('GET', `/api/products/${encodeURIComponent(name)}/detail`);
    detail.value = data;
  } catch {
    detail.value = null;
  } finally {
    detailLoading.value = false;
  }
}

function OverviewTab({ plane, d }: { plane: Plane; d: PlaneDetail }) {
  const described = d.tables.filter(t => t.fields.some(f => f.description && !f.description.startsWith('TODO'))).length;
  const withSamples = d.tables.filter(t => t.fields.some(f => f.sampleValues.length > 0)).length;
  const withRoles = d.tables.filter(t => t.fields.some(f => f.semanticRole)).length;

  return (
    <div>
      <div class="plane-overview-grid">
        <div class="plane-stat-card">
          <div class="plane-stat-value">{d.tables.length}</div>
          <div class="plane-stat-label">Tables</div>
        </div>
        <div class="plane-stat-card">
          <div class="plane-stat-value">{d.tables.reduce((s, t) => s + t.fields.length, 0)}</div>
          <div class="plane-stat-label">Columns</div>
        </div>
        <div class="plane-stat-card">
          <div class="plane-stat-value">{described}</div>
          <div class="plane-stat-label">Tables Described</div>
        </div>
        <div class="plane-stat-card">
          <div class="plane-stat-value">{withSamples}</div>
          <div class="plane-stat-label">With Samples</div>
        </div>
      </div>

      <div class="plane-overview-sections">
        {d.rules.joinRules.length > 0 && (
          <div class="plane-overview-section">
            <h4>Join Rules <Badge variant="info">{d.rules.joinRules.length}</Badge></h4>
            {d.rules.joinRules.slice(0, 5).map((r: any, i: number) => (
              <div class="plane-rule-item" key={i}>
                <code>{r.left || r.from}</code> → <code>{r.right || r.to}</code>
                {r.on && <span class="muted"> on {typeof r.on === 'string' ? r.on : JSON.stringify(r.on)}</span>}
              </div>
            ))}
            {d.rules.joinRules.length > 5 && <p class="muted">+ {d.rules.joinRules.length - 5} more</p>}
          </div>
        )}

        {d.rules.goldenQueries.length > 0 && (
          <div class="plane-overview-section">
            <h4>Golden Queries <Badge variant="gold">{d.rules.goldenQueries.length}</Badge></h4>
            {d.rules.goldenQueries.map((q: any, i: number) => (
              <div class="plane-rule-item" key={i}>
                <div class="plane-query-q">{q.question || q.name || `Query ${i + 1}`}</div>
                {q.sql && <code class="plane-query-sql">{q.sql}</code>}
              </div>
            ))}
          </div>
        )}

        {d.rules.guardrails.length > 0 && (
          <div class="plane-overview-section">
            <h4>Guardrails <Badge variant="warning">{d.rules.guardrails.length}</Badge></h4>
            {d.rules.guardrails.map((g: any, i: number) => (
              <div class="plane-rule-item" key={i}>
                <strong>{g.name || `Filter ${i + 1}`}</strong>
                {g.description && <span class="muted"> — {g.description}</span>}
              </div>
            ))}
          </div>
        )}

        {d.glossary.length > 0 && (
          <div class="plane-overview-section">
            <h4>Glossary <Badge variant="info">{d.glossary.length}</Badge></h4>
            {d.glossary.map((t: any, i: number) => (
              <div class="plane-rule-item" key={i}>
                <strong>{t.term || t.name}</strong>
                {t.definition && <span class="muted"> — {t.definition}</span>}
              </div>
            ))}
          </div>
        )}

        {d.owners.length > 0 && (
          <div class="plane-overview-section">
            <h4>Owners</h4>
            {d.owners.map((o: any, i: number) => (
              <div class="plane-rule-item" key={i}>
                <strong>{o.name || o.team}</strong>
                {o.email && <span class="muted"> — {o.email}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TablesTab({ d }: { d: PlaneDetail }) {
  const expanded = expandedTable.value;
  return (
    <div class="plane-tables-list">
      <div class="plane-table-row plane-table-header-row">
        <span class="plane-table-name">Table</span>
        <span class="plane-table-cols">Columns</span>
      </div>
      {d.tables.map(t => (
        <div key={t.name}>
          <div
            class={`plane-table-row plane-table-clickable${expanded === t.name ? ' expanded' : ''}`}
            onClick={() => { expandedTable.value = expanded === t.name ? null : t.name; }}
          >
            <span class="plane-table-name">
              <code>{t.name}</code>
            </span>
            <span class="plane-table-cols">{t.fields.length}</span>
          </div>
          {expanded === t.name && (
            <div class="plane-fields-panel">
              {t.fields.map(f => (
                <div class="plane-field-row" key={f.name}>
                  <div class="plane-field-header">
                    <code class="plane-field-name">{f.name}</code>
                    <span class="plane-field-type">{f.type}</span>
                    {f.semanticRole && <Badge variant="gold">{f.semanticRole}</Badge>}
                  </div>
                  {f.description && <div class="plane-field-desc">{f.description}</div>}
                  {f.sampleValues.length > 0 && (
                    <div class="plane-field-samples">
                      {f.sampleValues.slice(0, 5).map((v, i) => (
                        <span class="plane-sample-chip" key={i}>{String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RulesTab({ d }: { d: PlaneDetail }) {
  return (
    <div class="plane-rules-tab">
      {d.rules.joinRules.length > 0 && (
        <div class="plane-overview-section">
          <h4>Join Rules</h4>
          {d.rules.joinRules.map((r: any, i: number) => (
            <div class="plane-rule-card" key={i}>
              <code>{r.left || r.from}</code>
              <span class="plane-join-arrow">→</span>
              <code>{r.right || r.to}</code>
              {r.on && <div class="plane-join-on">ON {typeof r.on === 'string' ? r.on : JSON.stringify(r.on)}</div>}
              {r.type && <Badge variant="info">{r.type}</Badge>}
            </div>
          ))}
        </div>
      )}
      {d.rules.grainStatements.length > 0 && (
        <div class="plane-overview-section">
          <h4>Grain Statements</h4>
          {d.rules.grainStatements.map((g: any, i: number) => (
            <div class="plane-rule-item" key={i}>
              <strong>{g.table || g.name}</strong>: {g.grain || g.statement || JSON.stringify(g)}
            </div>
          ))}
        </div>
      )}
      {d.rules.goldenQueries.length > 0 && (
        <div class="plane-overview-section">
          <h4>Golden Queries</h4>
          {d.rules.goldenQueries.map((q: any, i: number) => (
            <Card key={i}>
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontWeight: 600, marginBottom: '6px' }}>{q.question || q.name || `Query ${i + 1}`}</div>
                {q.sql && <CodeBlock code={q.sql} />}
              </div>
            </Card>
          ))}
        </div>
      )}
      {d.rules.guardrails.length > 0 && (
        <div class="plane-overview-section">
          <h4>Guardrail Filters</h4>
          {d.rules.guardrails.map((g: any, i: number) => (
            <Card key={i}>
              <div style={{ padding: '4px 0' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>{g.name || `Filter ${i + 1}`}</div>
                {g.description && <div class="muted" style={{ marginBottom: '6px' }}>{g.description}</div>}
                {g.sql && <CodeBlock code={g.sql} />}
              </div>
            </Card>
          ))}
        </div>
      )}
      {d.rules.joinRules.length === 0 && d.rules.goldenQueries.length === 0 && d.rules.guardrails.length === 0 && d.rules.grainStatements.length === 0 && (
        <p class="muted">No rules defined yet. Run enrichment to generate rules.</p>
      )}
    </div>
  );
}

function YamlTab({ d }: { d: PlaneDetail }) {
  const yamlTab = signal<'model' | 'rules' | 'governance'>('model');
  const current = yamlTab.value;
  const code = current === 'model' ? d.yaml.model : current === 'rules' ? d.yaml.rules : d.yaml.governance;
  return (
    <div>
      <div class="plane-yaml-tabs">
        {(['model', 'rules', 'governance'] as const).map(t => (
          <button
            key={t}
            class={`plane-yaml-tab${current === t ? ' active' : ''}`}
            onClick={() => { yamlTab.value = t; }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      {code ? (
        <div class="plane-yaml-block">
          <CodeBlock code={code} />
        </div>
      ) : (
        <p class="muted">No {current} YAML file found.</p>
      )}
    </div>
  );
}

function CurateCallout({ tier }: { tier: string }) {
  const { toast } = useToast();
  if (tier === 'gold') return null;

  const nextTier = tier === 'bronze' ? 'Silver' : 'Gold';
  const message = tier === 'bronze'
    ? 'Your plane is at Bronze — scaffolded but not yet enriched with real data context. Have your AI agent curate it using your actual database.'
    : 'Your plane is at Silver — sample values are present. Add golden queries, guardrails, and rich descriptions to reach Gold.';

  return (
    <div class="curate-callout">
      <div class="curate-callout-content">
        <h4>Curate to {nextTier}</h4>
        <p class="muted">{message}</p>
        <Button variant="primary" size="sm" onClick={openCuratePanel}>
          Curate to {nextTier} →
        </Button>
      </div>
    </div>
  );
}

function CuratePanel() {
  const { toast } = useToast();
  if (!showCuratePanel.value) return null;

  return (
    <div class="curate-overlay">
      <div class="curate-panel">
        <div class="curate-panel-header">
          <h3>Agent-Driven Curation</h3>
          <button class="curate-panel-close" onClick={() => { showCuratePanel.value = false; }}>✕</button>
        </div>

        <div class="curate-panel-body">
          <div class="curate-panel-step">
            <div class="curate-step-num">1</div>
            <div>
              <h4>Add MCP Config to Your IDE</h4>
              <p class="muted">Copy this into your IDE's MCP settings (Claude Code, Cursor, etc.)</p>
              {curateMcpConfig.value && (
                <div style={{ marginTop: '8px' }}>
                  <CodeBlock code={curateMcpConfig.value} />
                  <Button variant="secondary" size="sm" onClick={() => {
                    navigator.clipboard.writeText(curateMcpConfig.value || '');
                    toast('success', 'Copied MCP config');
                  }} style={{ marginTop: '8px' }}>Copy Config</Button>
                </div>
              )}
            </div>
          </div>

          <div class="curate-panel-step">
            <div class="curate-step-num">2</div>
            <div>
              <h4>Paste This Prompt in Your IDE</h4>
              <p class="muted">Your AI agent will query your database and curate the metadata to Gold.</p>
              <div class="curate-prompt-block" style={{ marginTop: '8px' }}>
                <div class="curate-prompt-text">{CURATION_PROMPT}</div>
                <Button variant="primary" size="sm" onClick={() => {
                  navigator.clipboard.writeText(CURATION_PROMPT);
                  toast('success', 'Curation prompt copied — paste it in your IDE');
                }} style={{ marginTop: '8px' }}>Copy Curation Prompt</Button>
              </div>
            </div>
          </div>

          <div class="curate-panel-step">
            <div class="curate-step-num">3</div>
            <div>
              <h4>Refresh to See Progress</h4>
              <p class="muted">After your agent curates, refresh the Semantic Planes page or run <code>context tier</code> to check your tier.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlanesPage() {
  if (!loaded.value) {
    loaded.value = true;
    loadPlanes();
  }

  const selected = selectedPlane.value;
  const selectedData = selected ? planes.value.find(p => p.name === selected) : null;
  const d = detail.value;
  const tab = activeTab.value;

  return (
    <div class="planes-page">
      <InfoCard title="Your Semantic Planes" storageKey="planes-page-info">
        <ConceptTerm term="semanticPlane" definition={CONCEPTS.semanticPlane.definition}>{CONCEPTS.semanticPlane.label}</ConceptTerm> organize your data context by domain.
        Each plane contains models, governance rules, guardrails, and a glossary.
        Build more planes by returning to <a href="/setup">Setup</a>.
      </InfoCard>

      {loading.value && (
        <div class="planes-grid">
          <Skeleton variant="card" width="100%" height="160px" />
          <Skeleton variant="card" width="100%" height="160px" />
        </div>
      )}

      {!loading.value && planes.value.length === 0 && (
        <EmptyState
          message="No semantic planes yet. Connect a database and run the setup wizard to create your first semantic plane."
          action={<a href="/setup" class="rc-btn rc-btn--primary">Go to Setup</a>}
        />
      )}

      {!loading.value && planes.value.length > 0 && !selected && (
        <>
          <div class="planes-grid">
            {planes.value.map(plane => (
              <Card key={plane.name} interactive>
                <div class="plane-card" onClick={() => selectPlane(plane.name)}>
                  <div class="plane-card-header">
                    <h3 class="plane-card-name">{plane.name}</h3>
                    {plane.tier && <TierBadge tier={plane.tier as any} />}
                  </div>
                  {plane.description && <p class="plane-card-desc">{plane.description}</p>}
                  <div class="plane-card-stats">
                    {plane.tables !== undefined && <Badge variant="info">{plane.tables} tables</Badge>}
                    {plane.columns !== undefined && <Badge variant="info">{plane.columns} columns</Badge>}
                  </div>
                  {plane.tier && plane.tier !== 'gold' && (
                    <div class="plane-card-cta">
                      Curate to {plane.tier === 'bronze' ? 'Silver' : 'Gold'} →
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {planes.value.some(p => p.tier && p.tier !== 'gold') && (
            <CurateCallout tier={planes.value[0]?.tier || 'bronze'} />
          )}
        </>
      )}

      {selected && selectedData && (
        <div class="plane-detail">
          <div class="plane-detail-header">
            <a class="plane-detail-back" onClick={() => { selectedPlane.value = null; }}>← All Planes</a>
          </div>
          <div class="plane-detail-hero">
            <div>
              <h2 class="plane-detail-name">{selectedData.name}</h2>
              {selectedData.description && <p class="plane-detail-desc">{selectedData.description}</p>}
            </div>
            <div class="plane-detail-tier-actions">
              {selectedData.tier && <TierBadge tier={selectedData.tier as any} />}
              {selectedData.tier && selectedData.tier !== 'gold' && (
                <Button variant="primary" size="sm" onClick={openCuratePanel}>
                  Curate to {selectedData.tier === 'bronze' ? 'Silver' : 'Gold'}
                </Button>
              )}
            </div>
          </div>

          <div class="plane-tabs">
            {(['overview', 'tables', 'rules', 'yaml'] as const).map(t => (
              <button
                key={t}
                class={`plane-tab${tab === t ? ' active' : ''}`}
                onClick={() => { activeTab.value = t; }}
              >
                {t === 'yaml' ? 'YAML Blueprint' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {detailLoading.value && (
            <div style={{ marginTop: '16px' }}>
              <Skeleton variant="text" width="100%" height="200px" />
            </div>
          )}

          {!detailLoading.value && d && (
            <div class="plane-tab-content">
              {tab === 'overview' && <OverviewTab plane={selectedData} d={d} />}
              {tab === 'tables' && <TablesTab d={d} />}
              {tab === 'rules' && <RulesTab d={d} />}
              {tab === 'yaml' && <YamlTab d={d} />}
            </div>
          )}
        </div>
      )}

      {error.value && <p class="field-error">{error.value}</p>}

      {!selected && (
        <div class="cloud-upsell">
          <Card>
            <div class="upsell-content">
              <h3>Want team collaboration?</h3>
              <p class="muted">RunContext Cloud lets your team collaborate on semantic planes, share MCP endpoints, and track analytics.</p>
              <a href="https://runcontext.dev/pricing" target="_blank" rel="noopener" class="rc-btn rc-btn--primary">
                Try RunContext Cloud →
              </a>
            </div>
          </Card>
        </div>
      )}

      <CuratePanel />
    </div>
  );
}
