import { sessionId, currentStep, pipelineStages, enrichProgress, enrichLogs } from './state';

let ws: WebSocket | null = null;

export function connectWebSocket(sid: string) {
  sessionId.value = sid;
  if (ws) {
    ws.onclose = null; // prevent triggering reconnect
    ws.close();
    ws = null;
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}/ws?session=${encodeURIComponent(sid)}&role=wizard`);

  ws.onmessage = (evt) => {
    try {
      const event = JSON.parse(evt.data);
      handleWsEvent(event);
    } catch { /* ignore */ }
  };

  ws.onclose = () => {
    setTimeout(() => {
      if (sessionId.value) connectWebSocket(sessionId.value);
    }, 2000);
  };

  ws.onerror = () => { /* onclose handles reconnect */ };
}

export function sendWsEvent(type: string, payload: Record<string, unknown> = {}) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type, sessionId: sessionId.value, payload }));
  }
}

function handleWsEvent(event: { type: string; payload?: Record<string, unknown> }) {
  const p = event.payload || {};
  switch (event.type) {
    case 'setup:step':
      if (p.step) currentStep.value = p.step as number;
      break;
    case 'setup:field': {
      const input = document.getElementById(p.fieldId as string) as HTMLInputElement | null;
      if (input) {
        input.value = (p.value as string) || '';
        input.dispatchEvent(new Event('input'));
      }
      break;
    }
    case 'pipeline:stage':
      pipelineStages.value = {
        ...pipelineStages.value,
        [p.stage as string]: { status: p.status as string, summary: p.summary as string | undefined, error: p.error as string | undefined },
      };
      break;
    case 'enrich:progress':
      enrichProgress.value = {
        ...enrichProgress.value,
        [p.requirement as string]: { status: p.status as string, progress: p.progress as string },
      };
      break;
    case 'enrich:log':
      enrichLogs.value = [
        ...enrichLogs.value,
        { message: p.message as string, timestamp: (p.timestamp as string) || new Date().toISOString() },
      ];
      break;
    case 'tier:update':
      // Handled via signal in Serve step
      break;
  }
}
