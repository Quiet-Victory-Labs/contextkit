import WebSocket from 'ws';

export interface SessionBridge {
  send(type: string, payload: Record<string, unknown>): void;
  close(): void;
}

const NOOP_BRIDGE: SessionBridge = {
  send() {},
  close() {},
};

export function createSessionBridge(
  sessionId: string | undefined,
  port: number = 4040,
): SessionBridge {
  if (!sessionId) return NOOP_BRIDGE;

  let ws: WebSocket | null = null;
  const queue: string[] = [];

  try {
    ws = new WebSocket(`ws://127.0.0.1:${port}/ws?session=${encodeURIComponent(sessionId)}&role=agent`);

    ws.on('open', () => {
      for (const msg of queue) {
        ws!.send(msg);
      }
      queue.length = 0;
    });

    ws.on('error', () => {
      // Silently fail — session bridge is best-effort
    });
  } catch {
    return NOOP_BRIDGE;
  }

  return {
    send(type: string, payload: Record<string, unknown>) {
      const msg = JSON.stringify({ type, sessionId, payload });
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      } else {
        queue.push(msg);
      }
    },
    close() {
      ws?.close();
    },
  };
}
