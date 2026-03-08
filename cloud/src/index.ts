import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth } from './middleware/auth.js';
import { publish } from './routes/publish.js';
import { api } from './routes/api.js';
import { studio } from './routes/studio.js';
import { mcp } from './mcp/server.js';
import { billing } from './routes/billing.js';

const app = new Hono();

app.use('/api/*', cors());
app.use('/mcp/*', cors());

// ---------------------------------------------------------------------------
// Public routes (no auth required)
// ---------------------------------------------------------------------------
app.get('/api/health', (c) => c.json({ ok: true, service: 'ContextKit Cloud' }));

// Studio is public
app.route('', studio);

// ---------------------------------------------------------------------------
// Protected routes — require auth on specific path prefixes
// ---------------------------------------------------------------------------
app.use('/api/publish', requireAuth);
app.use('/api/orgs/:org/*', requireAuth);
app.use('/api/billing/checkout', requireAuth);
app.use('/api/billing/portal', requireAuth);
app.use('/api/billing/subscription/:org', requireAuth);
// MCP auth is already applied inside mcp/server.ts via requireAuth middleware

// Mount route groups
app.route('', publish);
app.route('', api);
app.route('', mcp);
app.route('', billing);

export default app;
