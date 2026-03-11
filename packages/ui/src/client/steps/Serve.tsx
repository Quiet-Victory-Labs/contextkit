import { signal } from '@preact/signals';
import { Button, Card, TierBadge, CodeBlock } from '@runcontext/uxd/react';
import { api } from '../api';
import { pipelineId, currentStep } from '../state';

const tier = signal<'bronze' | 'silver' | 'gold'>('bronze');
const mcpConfig = signal<string | null>(null);
const mcpLoading = signal(false);
const tierLoaded = signal(false);

export function Serve() {
  // Fetch tier from pipeline status
  if (!tierLoaded.value && pipelineId.value) {
    tierLoaded.value = true;
    api<any>('GET', '/api/pipeline/status/' + pipelineId.value).then(data => {
      const stages = data.stages || [];
      let hasSilver = false;
      let hasGold = false;
      for (const s of stages) {
        if ((s.name === 'enrich-gold' || s.stage === 'enrich-gold') && s.status === 'done') hasGold = true;
        if ((s.name === 'enrich-silver' || s.stage === 'enrich-silver') && s.status === 'done') hasSilver = true;
      }
      if (hasGold) tier.value = 'gold';
      else if (hasSilver) tier.value = 'silver';
    }).catch(() => {});
  }

  async function loadMcpConfig() {
    mcpLoading.value = true;
    try {
      const config = await api<any>('GET', '/api/mcp-config');
      mcpConfig.value = JSON.stringify(config, null, 2);
    } catch { /* ignore */ }
    finally { mcpLoading.value = false; }
  }

  const tierLabel = tier.value.charAt(0).toUpperCase() + tier.value.slice(1);

  return (
    <Card className="serve-card">
      <h2>Your Semantic Plane is Ready</h2>

      <TierBadge tier={tier.value} />

      <p class="muted">Your {tierLabel} tier semantic plane is ready for AI agents.</p>

      {tier.value !== 'gold' && (
        <p class="muted" style={{ marginTop: '8px' }}>
          To reach Gold, run enrichment with <code>context enrich --target gold</code>.
        </p>
      )}

      <div class="serve-ctas">
        <Button onClick={loadMcpConfig} disabled={mcpLoading.value}>
          {mcpLoading.value ? 'Loading...' : 'Start MCP Server'}
        </Button>
        <Button variant="secondary" disabled title="Coming soon">Publish to Cloud</Button>
      </div>

      {mcpConfig.value && (
        <>
          <CodeBlock code={mcpConfig.value} />
          <p class="muted" style={{ marginTop: '8px', fontSize: '0.85rem' }}>
            Copy the JSON above into your IDE's MCP settings, or run: <code>context serve</code>
          </p>
        </>
      )}

      <div class="serve-commands">
        <div class="serve-commands-title">CLI Commands</div>
        {[
          ['context serve', 'Start the MCP server'],
          ['context tier', 'Check your current tier'],
          ['context enrich --target gold', 'Enrich to Gold tier'],
          ['context verify', 'Validate your semantic plane'],
        ].map(([cmd, desc]) => (
          <div class="serve-cmd-row">
            <span class="serve-cmd">{cmd}</span>
            <span class="serve-cmd-desc">{desc}</span>
          </div>
        ))}
      </div>

      {tier.value !== 'gold' && (
        <p style={{ marginTop: '16px' }}>
          <a
            style={{ color: 'var(--rc-color-accent, #c9a55a)', cursor: 'pointer', fontSize: '0.875rem' }}
            onClick={() => { currentStep.value = 5; }}
          >
            Continue Enrichment
          </a>
        </p>
      )}

      <div class="step-actions">
        <Button variant="secondary" onClick={() => { currentStep.value = currentStep.value - 1; }}>Back</Button>
      </div>
    </Card>
  );
}
