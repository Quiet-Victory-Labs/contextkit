import { Hono } from 'hono';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { parse } from 'yaml';

const execFile = promisify(execFileCb);

export interface ExistingProduct {
  name: string;
  description?: string;
  sensitivity?: string;
  tier?: string;
  tables?: number;
  columns?: number;
  hasBrief: boolean;
}

function detectTier(contextDir: string, sourceName: string): string {
  const rulesPath = path.join(contextDir, 'rules', `${sourceName}.rules.yaml`);
  const modelPath = path.join(contextDir, 'models', `${sourceName}.osi.yaml`);

  // Gold: needs real golden queries (not TODO), real guardrails, meaningful descriptions
  if (fs.existsSync(rulesPath)) {
    try {
      const rules = parse(fs.readFileSync(rulesPath, 'utf-8'));
      const realQueries = (rules?.golden_queries || []).filter((q: any) =>
        q.sql && !q.sql.includes('TODO') && !q.sql.includes('table_name') &&
        q.question && !q.question.includes('TODO')
      );
      const realGuardrails = (rules?.guardrail_filters || rules?.guardrails || []).filter((g: any) =>
        g.name && !g.name.includes('TODO')
      );
      if (realQueries.length >= 3 && realGuardrails.length >= 1) return 'gold';
    } catch { /* ignore */ }
  }

  // Silver: needs sample_values on at least 2 fields
  if (fs.existsSync(modelPath)) {
    try {
      const model = parse(fs.readFileSync(modelPath, 'utf-8'));
      let datasets: any[] = model?.tables || model?.models || [];
      if (datasets.length === 0 && Array.isArray(model?.semantic_model)) {
        for (const sm of model.semantic_model) {
          if (Array.isArray(sm.datasets)) datasets.push(...sm.datasets);
        }
      }
      let fieldsWithSamples = 0;
      for (const d of datasets) {
        for (const f of (d.columns || d.fields || [])) {
          if (f.sample_values?.length > 0) fieldsWithSamples++;
        }
      }
      if (fieldsWithSamples >= 2) return 'silver';
    } catch { /* ignore */ }
  }

  return 'bronze';
}

function countTablesAndColumns(contextDir: string, sourceName: string): { tables: number; columns: number } {
  const modelPath = path.join(contextDir, 'models', `${sourceName}.osi.yaml`);
  if (!fs.existsSync(modelPath)) return { tables: 0, columns: 0 };
  try {
    const model = parse(fs.readFileSync(modelPath, 'utf-8'));
    // Support both flat (tables/models) and nested (semantic_model[].datasets[]) formats
    let datasets: any[] = model?.tables || model?.models || [];
    if (datasets.length === 0 && Array.isArray(model?.semantic_model)) {
      for (const sm of model.semantic_model) {
        if (Array.isArray(sm.datasets)) datasets.push(...sm.datasets);
      }
    }
    const columns = datasets.reduce((sum: number, t: any) => sum + (t.columns?.length || t.fields?.length || 0), 0);
    return { tables: datasets.length, columns };
  } catch {
    return { tables: 0, columns: 0 };
  }
}

export function productsRoutes(contextDir: string): Hono {
  const app = new Hono();

  app.get('/api/products', (c) => {
    if (!fs.existsSync(contextDir)) {
      return c.json([]);
    }

    const products: ExistingProduct[] = [];

    // Scan for *.context-brief.yaml files in the context dir
    const briefFiles = fs.readdirSync(contextDir).filter(f => f.endsWith('.context-brief.yaml'));

    for (const briefFile of briefFiles) {
      const briefPath = path.join(contextDir, briefFile);
      try {
        const brief = parse(fs.readFileSync(briefPath, 'utf-8'));
        const name = brief?.product_name || briefFile.replace('.context-brief.yaml', '');

        // Find associated model: check brief for data_source, then scan models dir
        const modelsDir = path.join(contextDir, 'models');
        let sourceName = '';
        const briefSource = brief?.data_sources?.[0]?.name || brief?.data_source || '';
        if (briefSource && fs.existsSync(path.join(modelsDir, `${briefSource}.osi.yaml`))) {
          sourceName = briefSource;
        } else if (fs.existsSync(modelsDir)) {
          const modelFiles = fs.readdirSync(modelsDir).filter(f => f.endsWith('.osi.yaml'));
          if (modelFiles.length > 0) {
            sourceName = modelFiles[0].replace('.osi.yaml', '');
          }
        }

        const { tables, columns } = sourceName
          ? countTablesAndColumns(contextDir, sourceName)
          : { tables: 0, columns: 0 };

        const tier = sourceName ? detectTier(contextDir, sourceName) : 'bronze';

        products.push({
          name,
          description: brief?.description,
          sensitivity: brief?.sensitivity,
          tier,
          tables,
          columns,
          hasBrief: true,
        });
      } catch {
        // ignore parse errors
      }
    }

    // Deduplicate by name (keep first)
    const seen = new Set<string>();
    const unique = products.filter(p => {
      if (seen.has(p.name)) return false;
      seen.add(p.name);
      return true;
    });

    return c.json(unique);
  });

  // Detail: full semantic plane content
  app.get('/api/products/:name/detail', (c) => {
    const modelsDir = path.join(contextDir, 'models');
    const rulesDir = path.join(contextDir, 'rules');
    const govDir = path.join(contextDir, 'governance');
    const glossaryDir = path.join(contextDir, 'glossary');
    const ownersDir = path.join(contextDir, 'owners');

    // Find model file
    const modelFiles = fs.existsSync(modelsDir)
      ? fs.readdirSync(modelsDir).filter(f => f.endsWith('.osi.yaml'))
      : [];
    const sourceName = modelFiles.length > 0 ? modelFiles[0].replace('.osi.yaml', '') : '';

    // Parse model
    let tables: any[] = [];
    let modelYaml = '';
    if (sourceName) {
      const modelPath = path.join(modelsDir, modelFiles[0]);
      modelYaml = fs.readFileSync(modelPath, 'utf-8');
      try {
        const model = parse(modelYaml);
        let datasets: any[] = model?.tables || model?.models || [];
        if (datasets.length === 0 && Array.isArray(model?.semantic_model)) {
          for (const sm of model.semantic_model) {
            if (Array.isArray(sm.datasets)) datasets.push(...sm.datasets);
          }
        }
        tables = datasets.map((d: any) => {
          const fields = d.columns || d.fields || [];
          return {
            name: d.name,
            description: d.description || '',
            fields: fields.map((f: any) => ({
              name: f.name,
              type: f.type || f.data_type || '',
              description: f.description || '',
              sampleValues: f.sample_values || [],
              semanticRole: f.semantic_role || '',
            })),
          };
        });
      } catch { /* ignore */ }
    }

    // Parse rules
    let rules: any = {};
    let rulesYaml = '';
    if (sourceName) {
      const rulesPath = path.join(rulesDir, `${sourceName}.rules.yaml`);
      if (fs.existsSync(rulesPath)) {
        rulesYaml = fs.readFileSync(rulesPath, 'utf-8');
        try { rules = parse(rulesYaml) || {}; } catch { /* ignore */ }
      }
    }

    // Parse governance
    let governance: any = {};
    let govYaml = '';
    if (sourceName) {
      const govPath = path.join(govDir, `${sourceName}.governance.yaml`);
      if (fs.existsSync(govPath)) {
        govYaml = fs.readFileSync(govPath, 'utf-8');
        try { governance = parse(govYaml) || {}; } catch { /* ignore */ }
      }
    }

    // Parse glossary
    const glossary: any[] = [];
    if (fs.existsSync(glossaryDir)) {
      for (const f of fs.readdirSync(glossaryDir).filter(f => f.endsWith('.term.yaml'))) {
        try {
          const term = parse(fs.readFileSync(path.join(glossaryDir, f), 'utf-8'));
          if (term) glossary.push(term);
        } catch { /* ignore */ }
      }
    }

    // Parse owners
    const owners: any[] = [];
    if (fs.existsSync(ownersDir)) {
      for (const f of fs.readdirSync(ownersDir).filter(f => f.endsWith('.owner.yaml'))) {
        try {
          const owner = parse(fs.readFileSync(path.join(ownersDir, f), 'utf-8'));
          if (owner) owners.push(owner);
        } catch { /* ignore */ }
      }
    }

    return c.json({
      tables,
      rules: {
        joinRules: rules.join_rules || [],
        goldenQueries: rules.golden_queries || [],
        guardrails: rules.guardrail_filters || rules.guardrails || [],
        grainStatements: rules.grain_statements || [],
      },
      governance,
      glossary,
      owners,
      yaml: {
        model: modelYaml.slice(0, 50000),
        rules: rulesYaml.slice(0, 20000),
        governance: govYaml.slice(0, 10000),
      },
    });
  });

  // Tier scorecard via CLI
  app.get('/api/tier', async (c) => {
    const cwdCli = path.join(process.cwd(), 'packages', 'cli', 'dist', 'index.js');
    const cliPath = fs.existsSync(cwdCli) ? cwdCli : null;
    if (!cliPath) return c.json({ tier: 'unknown', output: 'CLI not found' });

    try {
      const { stdout } = await execFile(process.execPath, [cliPath, 'tier'], {
        cwd: process.cwd(),
        timeout: 15_000,
        env: { ...process.env, NODE_OPTIONS: '--no-deprecation' },
      });
      const tierMatch = stdout.match(/(BRONZE|SILVER|GOLD)/i);
      return c.json({ tier: tierMatch ? tierMatch[1].toLowerCase() : 'unknown', output: stdout });
    } catch (err: any) {
      const stdout = err?.stdout || '';
      const tierMatch = stdout.match(/(BRONZE|SILVER|GOLD)/i);
      return c.json({ tier: tierMatch ? tierMatch[1].toLowerCase() : 'unknown', output: stdout || err.message });
    }
  });

  // Agent instructions
  app.get('/api/agent-instructions', (c) => {
    // Try to find the built agent instructions from the dist manifest
    const distInstructions = path.join(process.cwd(), 'dist', 'AGENT_INSTRUCTIONS.md');
    const cliInstructions = path.join(process.cwd(), 'packages', 'cli', 'assets', 'AGENT_INSTRUCTIONS.md');
    const instrPath = fs.existsSync(distInstructions) ? distInstructions : fs.existsSync(cliInstructions) ? cliInstructions : null;

    if (!instrPath) {
      return c.json({ instructions: null, error: 'Agent instructions not found' });
    }

    return c.json({ instructions: fs.readFileSync(instrPath, 'utf-8') });
  });

  return app;
}
