import { describe, it, expect, beforeEach } from 'vitest';
import app from '../index.js';
import { storage } from '../storage.js';

/** Helper to send a JSON-RPC request to the MCP endpoint. */
function mcpRequest(
  org: string,
  body: unknown,
  token = 'test-key',
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
  return app.request(`/mcp/${org}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

/** Helper to send a JSON-RPC request without auth. */
function mcpRequestNoAuth(org: string, body: unknown): Promise<Response> {
  return app.request(`/mcp/${org}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const sampleManifest = {
  version: '0.5.0',
  generatedAt: '2026-01-01T00:00:00.000Z',
  products: {
    'player-engagement': {
      models: {
        sessions: { name: 'sessions', description: 'Player session data' },
      },
      governance: {},
      rules: {},
      lineage: {},
    },
  },
  models: {
    sessions: { name: 'sessions', description: 'Player session data' },
    events: { name: 'events', description: 'Game event log' },
  },
  governance: {
    sessions: { owner: 'data-team', tags: ['gaming'] },
  },
  rules: {
    sessions: {
      golden_queries: [
        {
          question: 'How many active sessions today?',
          sql: 'SELECT count(*) FROM sessions WHERE date = current_date',
        },
      ],
      guardrail_filters: [
        {
          tables: ['sessions'],
          condition: 'date >= current_date - 90',
          reason: 'Only query last 90 days',
        },
      ],
    },
  },
  lineage: {
    sessions: { upstream: ['raw_events'] },
  },
  terms: {
    dau: { name: 'dau', definition: 'Daily active users', tags: ['gaming'] },
  },
  owners: {
    'data-team': { display_name: 'Data Team' },
  },
  tiers: {
    sessions: { tier: 'gold' },
  },
};

const sampleFiles = [
  { path: 'models/sessions.yaml', content: 'name: sessions\n' },
];

/** Publish sample data to storage for an org. */
function publishSample(org = 'acme') {
  storage.putPlane(org, sampleManifest, sampleFiles);
}

describe('MCP over JSON-RPC', () => {
  beforeEach(() => {
    storage.clear();
  });

  // -- Auth --
  describe('Auth', () => {
    it('rejects requests without Authorization header', async () => {
      const res = await mcpRequestNoAuth('acme', {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });
      expect(res.status).toBe(401);
    });

    it('rejects requests with empty bearer token', async () => {
      const res = await mcpRequest(
        'acme',
        { jsonrpc: '2.0', id: 1, method: 'initialize' },
        '',
      );
      expect(res.status).toBe(401);
    });
  });

  // -- Initialize --
  describe('initialize', () => {
    it('returns server info and capabilities', async () => {
      const res = await mcpRequest('acme', {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.jsonrpc).toBe('2.0');
      expect(body.id).toBe(1);
      expect(body.result.serverInfo.name).toBe('contextkit-cloud');
      expect(body.result.capabilities.tools).toBeDefined();
      expect(body.result.protocolVersion).toBe('2024-11-05');
    });
  });

  // -- notifications/initialized --
  describe('notifications/initialized', () => {
    it('returns 204 with no body', async () => {
      const res = await mcpRequest('acme', {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      });
      expect(res.status).toBe(204);
    });
  });

  // -- tools/list --
  describe('tools/list', () => {
    it('returns all tool definitions', async () => {
      const res = await mcpRequest('acme', {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      const tools = body.result.tools;
      expect(tools.length).toBe(6);

      const names = tools.map((t: any) => t.name);
      expect(names).toContain('context_search');
      expect(names).toContain('context_explain');
      expect(names).toContain('context_golden_query');
      expect(names).toContain('context_guardrails');
      expect(names).toContain('list_products');
      expect(names).toContain('get_product');
    });
  });

  // -- tools/call --
  describe('tools/call', () => {
    it('returns error when org has no published data', async () => {
      const res = await mcpRequest('acme', {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'context_search', arguments: { query: 'test' } },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.result.isError).toBe(true);
      expect(body.result.content[0].text).toContain('No published');
    });

    it('returns error for unknown tool', async () => {
      publishSample();
      const res = await mcpRequest('acme', {
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'nonexistent_tool', arguments: {} },
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32601);
    });

    it('returns error when params.name is missing', async () => {
      const res = await mcpRequest('acme', {
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {},
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.error).toBeDefined();
      expect(body.error.code).toBe(-32602);
    });

    // -- context_search --
    describe('context_search', () => {
      it('searches and finds models by name', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: { name: 'context_search', arguments: { query: 'sessions' } },
        });
        const body = (await res.json()) as any;
        const results = JSON.parse(body.result.content[0].text);
        expect(results.length).toBeGreaterThan(0);
        expect(results.some((r: any) => r.name === 'sessions')).toBe(true);
      });
    });

    // -- context_explain --
    describe('context_explain', () => {
      it('explains a model with governance context', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: { name: 'context_explain', arguments: { model: 'sessions' } },
        });
        const body = (await res.json()) as any;
        const result = JSON.parse(body.result.content[0].text);
        expect(result.model.name).toBe('sessions');
        expect(result.governance).toBeDefined();
        expect(result.lineage).toBeDefined();
        expect(result.tier).toBeDefined();
      });

      it('returns error for unknown model', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/call',
          params: {
            name: 'context_explain',
            arguments: { model: 'nonexistent' },
          },
        });
        const body = (await res.json()) as any;
        const result = JSON.parse(body.result.content[0].text);
        expect(result.error).toContain('not found');
      });
    });

    // -- context_golden_query --
    describe('context_golden_query', () => {
      it('finds golden queries matching a question', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 13,
          method: 'tools/call',
          params: {
            name: 'context_golden_query',
            arguments: { question: 'active sessions' },
          },
        });
        const body = (await res.json()) as any;
        const results = JSON.parse(body.result.content[0].text);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].model).toBe('sessions');
      });
    });

    // -- context_guardrails --
    describe('context_guardrails', () => {
      it('finds guardrail filters for matching tables', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 14,
          method: 'tools/call',
          params: {
            name: 'context_guardrails',
            arguments: { tables: ['sessions'] },
          },
        });
        const body = (await res.json()) as any;
        const results = JSON.parse(body.result.content[0].text);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0].filter.condition).toContain('90');
      });

      it('returns empty array for non-matching tables', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 15,
          method: 'tools/call',
          params: {
            name: 'context_guardrails',
            arguments: { tables: ['nonexistent_table'] },
          },
        });
        const body = (await res.json()) as any;
        const results = JSON.parse(body.result.content[0].text);
        expect(results).toEqual([]);
      });
    });

    // -- list_products --
    describe('list_products', () => {
      it('lists products with model counts', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 16,
          method: 'tools/call',
          params: { name: 'list_products', arguments: {} },
        });
        const body = (await res.json()) as any;
        const results = JSON.parse(body.result.content[0].text);
        expect(results.length).toBe(1);
        expect(results[0].name).toBe('player-engagement');
        expect(results[0].modelCount).toBe(1);
      });
    });

    // -- get_product --
    describe('get_product', () => {
      it('returns product details', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 17,
          method: 'tools/call',
          params: {
            name: 'get_product',
            arguments: { name: 'player-engagement' },
          },
        });
        const body = (await res.json()) as any;
        const result = JSON.parse(body.result.content[0].text);
        expect(result.name).toBe('player-engagement');
      });

      it('returns error for unknown product', async () => {
        publishSample();
        const res = await mcpRequest('acme', {
          jsonrpc: '2.0',
          id: 18,
          method: 'tools/call',
          params: { name: 'get_product', arguments: { name: 'nonexistent' } },
        });
        const body = (await res.json()) as any;
        expect(body.result.isError).toBe(true);
        expect(body.result.content[0].text).toContain('not found');
      });
    });
  });

  // -- Invalid JSON-RPC --
  describe('Invalid JSON-RPC', () => {
    it('returns parse error for invalid JSON', async () => {
      const res = await app.request('/mcp/acme', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key',
        },
        body: 'not json',
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe(-32700);
    });

    it('returns invalid request for missing jsonrpc version', async () => {
      const res = await mcpRequest('acme', {
        id: 1,
        method: 'initialize',
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe(-32600);
    });

    it('returns method not found for unknown method', async () => {
      const res = await mcpRequest('acme', {
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown/method',
      });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe(-32601);
    });
  });

  // -- HTTP method restrictions --
  describe('HTTP method restrictions', () => {
    it('rejects GET requests with 405', async () => {
      const res = await app.request('/mcp/acme', {
        method: 'GET',
        headers: { Authorization: 'Bearer test-key' },
      });
      expect(res.status).toBe(405);
    });

    it('rejects DELETE requests with 405', async () => {
      const res = await app.request('/mcp/acme', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer test-key' },
      });
      expect(res.status).toBe(405);
    });
  });
});
