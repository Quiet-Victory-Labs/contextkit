interface StageRowProps {
  stageKey: string;
  label: string;
  status?: string;
  summary?: string;
  error?: string;
}

export function StageRow({ stageKey, label, status, summary, error }: StageRowProps) {
  const dotClass = ['stage-dot', status === 'running' ? 'running' : status === 'done' ? 'done' : status === 'error' ? 'error' : '']
    .filter(Boolean).join(' ');

  return (
    <div class="stage-row" data-stage={stageKey}>
      <span class={dotClass} />
      <span class="stage-name">{label}</span>
      {summary && <span class="stage-summary">{summary}</span>}
      {error && <span class="stage-error">{error}</span>}
    </div>
  );
}
