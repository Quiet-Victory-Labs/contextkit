import { signal } from '@preact/signals';
import { Button, Card, ErrorCard, InfoCard, ConceptTerm, useToast } from '@runcontext/uxd/react';
import { StageRow } from '../components/StageRow';
import { api } from '../api';
import { brief, sources, pipelineId, pipelineStages, currentStep } from '../state';
import { CONCEPTS } from '../concepts';

let toastRef: ((variant: string, message: string) => void) | null = null;

const SCAFFOLD_STAGES = [
  { key: 'introspect', label: 'Extracting schema from database...' },
  { key: 'scaffold', label: 'Building semantic plane files...' },
  { key: 'verify', label: 'Validating semantic plane...' },
  { key: 'autofix', label: 'Fixing any issues...' },
  { key: 'agent-instructions', label: 'Generating agent instructions...' },
];

const building = signal(false);
const errorMsg = signal('');
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

async function startBuild() {
  building.value = true;
  errorMsg.value = '';
  pipelineStages.value = {};

  const body: Record<string, string> = {
    productName: brief.value.product_name,
    targetTier: 'bronze',
  };
  if (sources.value[0]) {
    const src = sources.value[0];
    body.dataSource = (typeof src === 'string' ? src : src.name || src.database || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  toastRef?.('info', 'Building your semantic plane...');

  try {
    const result = await api<{ id: string }>('POST', '/api/pipeline/start', body);
    pipelineId.value = result.id;
    startPolling();
  } catch (e: any) {
    building.value = false;
    errorMsg.value = e.message || 'Failed to start build.';
  }
}

function startPolling() {
  stopPolling();

  async function poll() {
    if (!pipelineId.value) return;
    try {
      const status = await api<any>('GET', '/api/pipeline/status/' + pipelineId.value);
      const stages = status.stages || [];
      const stageMap: Record<string, { status: string; summary?: string; error?: string }> = {};
      let hasError = false;
      let allDone = true;

      for (const def of SCAFFOLD_STAGES) {
        const match = stages.find((s: any) => s.stage === def.key || s.name === def.key);
        if (!match || match.status === 'pending') {
          allDone = false;
          stageMap[def.key] = { status: 'pending' };
        } else {
          stageMap[def.key] = { status: match.status, summary: match.summary, error: match.error };
          if (match.status === 'running') allDone = false;
          if (match.status === 'error') { hasError = true; allDone = false; }
        }
      }

      pipelineStages.value = stageMap;

      if (hasError) {
        stopPolling();
        building.value = false;
        errorMsg.value = status.error || 'A pipeline stage failed.';
        toastRef?.('error', status.error || 'Build failed');
      } else if (allDone && stages.length > 0) {
        stopPolling();
        building.value = false;
        toastRef?.('success', 'Semantic plane built successfully!');
        currentStep.value = 4;
      }
    } catch { /* keep polling on network error */ }
  }

  poll();
  pollTimer = setInterval(poll, 2000);
}

function retry() {
  pipelineId.value = null;
  pipelineStages.value = {};
  errorMsg.value = '';
  startBuild();
}

export function Scaffold() {
  const { toast } = useToast();
  toastRef = toast;

  // Resume polling if we have a pipelineId
  if (pipelineId.value && !pollTimer && !errorMsg.value) {
    building.value = true;
    startPolling();
  }

  const stages = pipelineStages.value;

  return (
    <div>
      <InfoCard title="Building Your Context Layer" storageKey="scaffold-step-info">
        RunContext connects to your database read-only to extract schema metadata.
        No data leaves your machine — only structure and types are captured to build your <ConceptTerm term="semanticPlane" definition={CONCEPTS.semanticPlane.definition}>{CONCEPTS.semanticPlane.label}</ConceptTerm>.
      </InfoCard>
      <div class="trust-signal">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-status-success)" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span class="trust-signal-text">Read-only access — your data never leaves this machine</span>
      </div>
      <h2>Building Your Semantic Plane</h2>
      <p class="muted">Connecting to your database and extracting schema metadata. This creates a Bronze-tier semantic plane.</p>

      <div class="scaffold-stages">
        {SCAFFOLD_STAGES.map(stage => (
          <StageRow
            key={stage.key}
            stageKey={stage.key}
            label={stage.label}
            status={stages[stage.key]?.status}
            summary={stages[stage.key]?.summary}
            error={stages[stage.key]?.error}
          />
        ))}
      </div>

      {errorMsg.value && (
        <ErrorCard message={errorMsg.value} action={<Button onClick={retry}>Retry</Button>} />
      )}

      <div class="step-actions">
        <Button variant="secondary" onClick={() => { stopPolling(); currentStep.value = 2; }}>Back</Button>
        {!building.value && !pipelineId.value && !errorMsg.value && (
          <Button onClick={startBuild}>Start Build</Button>
        )}
        {building.value && <span class="muted">Build in progress...</span>}
      </div>
    </div>
  );
}
