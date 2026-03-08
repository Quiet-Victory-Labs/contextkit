/**
 * MCP-compatible JSON-RPC endpoint for Cloudflare Workers.
 *
 * Instead of using the MCP SDK's StreamableHTTPServerTransport (which requires
 * Node.js streams), we implement a lightweight JSON-RPC handler that speaks
 * the MCP protocol: initialize, tools/list, tools/call.
 *
 * Mounted at POST /mcp/:org
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { storage } from '../storage.js';
import { TOOL_DEFS, handleToolCall } from './tools.js';

const SERVER_INFO = {
  name: 'contextkit-cloud',
  version: '0.5.0',
};

// JSON-RPC error codes
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;
const INTERNAL_ERROR = -32603;

interface JsonRpcRequest {
  jsonrpc: string;
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function jsonrpcError(id: string | number | null | undefined, code: number, message: string) {
  return {
    jsonrpc: '2.0' as const,
    id: id ?? null,
    error: { code, message },
  };
}

function jsonrpcResult(id: string | number | null | undefined, result: unknown) {
  return {
    jsonrpc: '2.0' as const,
    id: id ?? null,
    result,
  };
}

const mcp = new Hono();

// Require auth on all MCP requests
mcp.use('/mcp/:org', requireAuth);

mcp.post('/mcp/:org', async (c) => {
  const org = c.req.param('org');

  // Parse the JSON-RPC request body
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(jsonrpcError(null, PARSE_ERROR, 'Parse error'), 200);
  }

  // Validate basic JSON-RPC shape
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return c.json(jsonrpcError(null, INVALID_REQUEST, 'Invalid request'), 200);
  }

  const req = body as JsonRpcRequest;

  if (req.jsonrpc !== '2.0' || typeof req.method !== 'string') {
    return c.json(
      jsonrpcError(req.id, INVALID_REQUEST, 'Invalid JSON-RPC 2.0 request'),
      200,
    );
  }

  // Route to the correct handler based on method
  switch (req.method) {
    case 'initialize':
      return c.json(
        jsonrpcResult(req.id, {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
          },
          serverInfo: SERVER_INFO,
        }),
        200,
      );

    case 'notifications/initialized':
      // Notification — no response needed, but we return an empty 200
      return c.body(null, 204);

    case 'tools/list':
      return c.json(
        jsonrpcResult(req.id, {
          tools: TOOL_DEFS,
        }),
        200,
      );

    case 'tools/call': {
      const params = req.params;
      if (!params || typeof params.name !== 'string') {
        return c.json(
          jsonrpcError(req.id, INVALID_PARAMS, 'Missing tool name in params'),
          200,
        );
      }

      const toolName = params.name;
      const toolArgs = (params.arguments ?? {}) as Record<string, unknown>;

      // Check that the org has published data
      const plane = storage.getPlane(org);
      if (!plane) {
        return c.json(
          jsonrpcResult(req.id, {
            content: [
              {
                type: 'text',
                text: `No published semantic plane found for org: ${org}`,
              },
            ],
            isError: true,
          }),
          200,
        );
      }

      // Check that the tool exists
      const toolExists = TOOL_DEFS.some((t) => t.name === toolName);
      if (!toolExists) {
        return c.json(
          jsonrpcError(req.id, METHOD_NOT_FOUND, `Unknown tool: ${toolName}`),
          200,
        );
      }

      try {
        const result = handleToolCall(toolName, toolArgs, org, storage);
        return c.json(jsonrpcResult(req.id, result), 200);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        return c.json(
          jsonrpcError(req.id, INTERNAL_ERROR, message),
          200,
        );
      }
    }

    default:
      return c.json(
        jsonrpcError(req.id, METHOD_NOT_FOUND, `Method not found: ${req.method}`),
        200,
      );
  }
});

// GET and DELETE are not supported
mcp.get('/mcp/:org', (c) => {
  return c.json(
    jsonrpcError(null, -32000, 'Method not allowed. Use POST.'),
    405,
  );
});

mcp.delete('/mcp/:org', (c) => {
  return c.json(
    jsonrpcError(null, -32000, 'Method not allowed. Use POST.'),
    405,
  );
});

export { mcp };
