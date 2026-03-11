import { signal, effect } from '@preact/signals';

const STORAGE_KEY = 'runcontext_wizard_state';

export const STEP_LABELS = ['Connect', 'Define', 'Scaffold', 'Checkpoint', 'Curate', 'Serve'] as const;

// Core signals
export const currentStep = signal(1);
export const brief = signal({
  product_name: '',
  description: '',
  owner: { name: '', team: '', email: '' },
  sensitivity: 'internal',
  docs: [] as string[],
});
export const sources = signal<any[]>([]);
export const pipelineId = signal<string | null>(null);
export const sessionId = signal<string | null>(null);

// Derived UI signals
export const pipelineStages = signal<Record<string, { status: string; summary?: string; error?: string }>>({});
export const enrichProgress = signal<Record<string, { status: string; progress: string }>>({});
export const enrichLogs = signal<Array<{ message: string; timestamp: string }>>([]);

// Restore from sessionStorage
function loadSavedState() {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const data = JSON.parse(saved);
    if (data.step) currentStep.value = data.step;
    if (data.brief) brief.value = data.brief;
    if (data.sources) sources.value = data.sources;
    if (data.pipelineId) pipelineId.value = data.pipelineId;
  } catch { /* ignore */ }
}

loadSavedState();

// Auto-save on change
effect(() => {
  const toSave = {
    step: currentStep.value,
    brief: brief.value,
    sources: sources.value,
    pipelineId: pipelineId.value,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch { /* ignore */ }
});
