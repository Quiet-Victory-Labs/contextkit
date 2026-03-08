import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { publish } from './routes/publish.js';
import { api } from './routes/api.js';

const app = new Hono();

app.use('*', cors());

// Health check
app.get('/api/health', (c) => c.json({ ok: true }));

// Mount route groups
app.route('', publish);
app.route('', api);

export default app;
