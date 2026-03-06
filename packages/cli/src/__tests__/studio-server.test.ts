import { describe, it, expect } from 'vitest';
import { SSEManager } from '../studio/sse.js';
import type { ServerResponse } from 'node:http';

describe('studio server', () => {
  it('module exports startStudioServer', async () => {
    const mod = await import('../studio/server.js');
    expect(typeof mod.startStudioServer).toBe('function');
  });
});

describe('SSEManager', () => {
  function mockResponse(): ServerResponse & { written: string[]; headArgs: unknown[] } {
    const written: string[] = [];
    const headArgs: unknown[] = [];
    const handlers: Record<string, Function> = {};
    return {
      written,
      headArgs,
      writeHead(...args: unknown[]) { headArgs.push(args); },
      write(data: string) { written.push(data); return true; },
      on(event: string, handler: Function) { handlers[event] = handler; },
      end() {},
    } as any;
  }

  it('sends connected message on addClient', () => {
    const sse = new SSEManager();
    const res = mockResponse();
    sse.addClient(res);
    expect(res.headArgs[0]).toEqual([200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    }]);
    expect(res.written[0]).toBe('data: {"type":"connected"}\n\n');
  });

  it('broadcasts to all connected clients', () => {
    const sse = new SSEManager();
    const res1 = mockResponse();
    const res2 = mockResponse();
    sse.addClient(res1);
    sse.addClient(res2);
    sse.broadcast('update', { tier: 'gold' });
    expect(res1.written).toContainEqual('event: update\ndata: {"tier":"gold"}\n\n');
    expect(res2.written).toContainEqual('event: update\ndata: {"tier":"gold"}\n\n');
  });

  it('handles write errors gracefully', () => {
    const sse = new SSEManager();
    const res = mockResponse();
    sse.addClient(res);
    // Override write after connection to simulate broken pipe during broadcast
    res.write = () => { throw new Error('broken pipe'); };
    // Should not throw
    expect(() => sse.broadcast('update', {})).not.toThrow();
  });
});
