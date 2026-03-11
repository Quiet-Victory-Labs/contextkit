import { signal } from '@preact/signals';
import { Button, Card, ErrorCard, ActivityFeed } from '@runcontext/uxd/react';
import type { ActivityEvent } from '@runcontext/uxd/react';
import { api } from '../api';
import { brief, sources, pipelineId, enrichProgress, enrichLogs, currentStep } from '../state';

const ENRICH_REQUIREMENTS = [
  { key: 'column-descriptions', label: 'Column descriptions', initial: '0/45 columns' },
  { key: 'sample-values', label: 'Sample values', initial: '0/45 columns' },
  { key: 'join-rules', label: 'Join rules', initial: '0/0' },
  { key: 'grain-statements', label: 'Grain statements', initial: '0/0' },
  { key: 'semantic-roles', label: 'Semantic roles', initial: '0/0' },
  { key: 'golden-queries', label: 'Golden queries', initial: '0/0' },
  { key: 'guardrail-filters', label: 'Guardrail filters', initial: '0/0' },
];

const enriching = signal(false);
const errorMsg = signal('');
const expandedReqs = signal<Set<string>>(new Set());
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function startEnrichment() {
  enriching.value = true;
  errorMsg.value = '';
  enrichProgress.value = {};
  enrichLogs.value = [{ message: 'Enrichment pipeline started.', timestamp: new Date().toISOString() }];

  const body: Record<string, string> = {
    productName: brief.value.product_name,
    targetTier: 'gold',
  };
  if (sources.value[0]) {
    const src = sources.value[0];
    body.dataSource = (typeof src === 'string' ? src : src.name || src.database || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  try {
    const result = await api<{ id: string }>('POST', '/api/pipeline/start', body);
    pipelineId.value = result.id;
    startPolling();
  } catch (e: any) {
    enriching.value = false;
    errorMsg.value = e.message || 'Failed to start enrichment.';
  }
}

function startPolling() {
  stopPolling();

  async function poll() {
    if (!pipelineId.value) return;
    try {
      const status = await api<any>('GET', '/api/pipeline/status/' + pipelineId.value);
      const stages = status.stages || [];
      let hasError = false;
      let silverDone = false;
      let goldDone = false;

      for (const s of stages) {
        if ((s.name === 'enrich-silver' || s.stage === 'enrich-silver') && s.status === 'done') silverDone = true;
        if ((s.name === 'enrich-gold' || s.stage === 'enrich-gold') && s.status === 'done') goldDone = true;
        if (s.status === 'error') hasError = true;
      }

      if (hasError) {
        stopPolling();
        enriching.value = false;
        errorMsg.value = status.error || 'An enrichment stage failed.';
      } else if (silverDone && goldDone) {
        stopPolling();
        enriching.value = false;
        enrichLogs.value = [...enrichLogs.value, { message: 'Gold enrichment complete! Advancing...', timestamp: new Date().toISOString() }];
        currentStep.value = 6;
      }
    } catch { /* keep polling */ }
  }

  poll();
  pollTimer = setInterval(poll, 3000);
}

function retry() {
  pipelineId.value = null;
  enrichProgress.value = {};
  enrichLogs.value = [];
  errorMsg.value = '';
  startEnrichment();
}

function toggleReq(key: string) {
  const next = new Set(expandedReqs.value);
  if (next.has(key)) next.delete(key); else next.add(key);
  expandedReqs.value = next;
}

export function Enrich() {
  const progress = enrichProgress.value;
  const expanded = expandedReqs.value;

  const activityEvents: ActivityEvent[] = enrichLogs.value.map((log, i) => ({
    id: String(i),
    type: 'log',
    message: log.message,
    timestamp: new Date(log.timestamp).toLocaleTimeString(),
  }));

  return (
    <Card>
      <h2>Enriching to Gold</h2>
      <p class="muted">RunContext is analyzing your schema to add descriptions, join rules, and query patterns.</p>

      {!enriching.value && !errorMsg.value && (
        <div class="step-actions">
          <Button variant="secondary" onClick={() => { currentStep.value = 4; }}>Back</Button>
          <Button onClick={startEnrichment}>Start Enrichment</Button>
        </div>
      )}

      <div class="enrich-dashboard">
        <div class="enrich-checklist">
          {ENRICH_REQUIREMENTS.map(req => {
            const p = progress[req.key];
            const status = p?.status || '';
            const dotClass = ['stage-dot', status === 'working' ? 'running' : status === 'done' ? 'done' : ''].filter(Boolean).join(' ');

            return (
              <div class={`enrich-row${expanded.has(req.key) ? ' expanded' : ''}`}>
                <div class="enrich-row-header" onClick={() => toggleReq(req.key)}>
                  <span class={dotClass} />
                  <span class="enrich-req-name">{req.label}</span>
                  <span class="enrich-progress">{p?.progress || req.initial}</span>
                  <span class="enrich-arrow">&#9654;</span>
                </div>
                <div class="enrich-row-detail">Details will appear as enrichment progresses.</div>
              </div>
            );
          })}
        </div>

        <div class="activity-log">
          <div class="activity-log-title">Activity Log</div>
          <ActivityFeed events={activityEvents} />
        </div>
      </div>

      {errorMsg.value && (
        <ErrorCard message={errorMsg.value} action={<Button onClick={retry}>Retry</Button>} />
      )}
    </Card>
  );
}
