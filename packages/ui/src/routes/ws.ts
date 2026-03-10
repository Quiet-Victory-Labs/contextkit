import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { setupBus, type SetupEvent } from '../events.js';

export function attachWebSocket(server: Server): void {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session');

    if (!sessionId) {
      ws.close(4001, 'session query param required');
      return;
    }

    // Auto-create session if it does not exist
    if (!setupBus.hasSession(sessionId)) {
      setupBus.createSession();
    }

    // Forward bus events to this WebSocket client
    const onEvent = (event: SetupEvent) => {
      if (event.sessionId !== sessionId) return;
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(event));
      }
    };
    setupBus.on('event', onEvent);

    // Receive messages from this client and broadcast via bus
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as SetupEvent;
        msg.sessionId = sessionId;
        setupBus.emitEvent(msg);
      } catch {
        // ignore malformed messages
      }
    });

    ws.on('close', () => {
      setupBus.off('event', onEvent);
    });
  });
}
