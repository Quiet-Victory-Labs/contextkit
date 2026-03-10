import { Hono } from 'hono';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);

export function suggestBriefRoutes(rootDir: string): Hono {
  const app = new Hono();

  app.post('/api/suggest-brief', async (c) => {
    const body = await c.req.json<{
      source?: {
        name?: string;
        adapter?: string;
        host?: string;
        metadata?: Record<string, unknown>;
      };
    }>();

    const source = body.source || {};
    const meta = source.metadata || {};

    // --- Derive product name ---
    // Use project name, db name, or fallback
    const projectName = (meta.project as string) || '';
    const dbName = source.name || '';
    const rawName = projectName || dbName || 'my-data';
    // Sanitize to alphanumeric + hyphens
    const productName = rawName
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    // --- Derive description ---
    const branch = (meta.branch as string) || 'main';
    const adapter = source.adapter || 'database';
    const region = (meta.region as string) || '';
    const org = (meta.org as string) || '';

    let description = `Semantic context for the ${rawName} ${adapter} database`;
    if (branch !== 'main') description += ` (${branch} branch)`;
    if (org && org !== 'Personal') description += `, managed by ${org}`;
    description += '.';

    // --- Git user info ---
    let ownerName = '';
    let ownerEmail = '';
    let ownerTeam = '';
    try {
      const { stdout: name } = await execFile('git', ['config', 'user.name'], {
        cwd: rootDir,
        timeout: 3000,
      });
      ownerName = name.trim();
    } catch { /* ignore */ }
    try {
      const { stdout: email } = await execFile('git', ['config', 'user.email'], {
        cwd: rootDir,
        timeout: 3000,
      });
      ownerEmail = email.trim();
    } catch { /* ignore */ }

    // Try to derive team from email domain or org
    if (org && org !== 'Personal') {
      ownerTeam = org;
    } else if (ownerEmail) {
      const domain = ownerEmail.split('@')[1];
      if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
        // Use domain name as team hint
        ownerTeam = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
      }
    }

    return c.json({
      product_name: productName,
      description,
      owner: {
        name: ownerName,
        email: ownerEmail,
        team: ownerTeam,
      },
      sensitivity: 'internal',
    });
  });

  return app;
}
