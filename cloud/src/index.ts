import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { publish } from './routes/publish.js';
import { api } from './routes/api.js';
import { studio } from './routes/studio.js';
import { mcp } from './mcp/server.js';

const app = new Hono();

app.use('*', cors());

// Health check
app.get('/api/health', (c) => c.json({ ok: true }));

// Mount route groups
app.route('', publish);
app.route('', api);
app.route('', studio);
app.route('', mcp);

export default app;
