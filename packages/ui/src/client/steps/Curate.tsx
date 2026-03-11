import { signal } from '@preact/signals';
import { Button, Card, CodeBlock, InfoCard, ConceptTerm, Badge, useToast } from '@runcontext/uxd/react';
import { api } from '../api';
import { currentStep } from '../state';
import { CONCEPTS } from '../concepts';

const tierOutput = signal<string | null>(null);
const tierLevel = signal<string>('');
const mcpConfig = signal<string | null>(null);
const agentInstructions = signal<string | null>(null);
const loaded = signal(false);
const showInstructions = signal(false);

const CURATION_PROMPT = `I have a RunContext semantic plane at Bronze tier. Please help me curate it to Gold.

Start by running \`context_tier\` to see the current scorecard, then work through each failing check:
1. Run small sample queries (LIMIT 10-25) to understand the actual data — never bulk export
2. Write meaningful descriptions, golden queries, guardrails, etc.
3. Re-run \`context_tier\` and iterate until Gold

Follow the agent instructions in AGENT_INSTRUCTIONS.md — never fabricate metadata, always query first. Never put PII in sample_values.`;

export function Curate() {
  const { toast } = useToast();

  if (!loaded.value) {
    loaded.value = true;
    api<{ tier: string; output: string }>('GET', '/api/tier').then(data => {
      tierLevel.value = data.tier;
      tierOutput.value = data.output;
    }).catch(() => {});
    api<any>('GET', '/api/mcp-config').then(data => {
      mcpConfig.value = JSON.stringify(data, null, 2);
    }).catch(() => {});
  }

  async function loadInstructions() {
    try {
      const data = await api<{ instructions: string | null }>('GET', '/api/agent-instructions');
      agentInstructions.value = data.instructions;
      showInstructions.value = true;
    } catch {
      toast('error', 'Failed to load agent instructions');
    }
  }

  async function refreshTier() {
    tierOutput.value = null;
    try {
      const data = await api<{ tier: string; output: string }>('GET', '/api/tier');
      tierLevel.value = data.tier;
      tierOutput.value = data.output;
      toast('success', `Current tier: ${data.tier.toUpperCase()}`);
    } catch {
      toast('error', 'Failed to check tier');
    }
  }

  function copyPrompt() {
    navigator.clipboard.writeText(CURATION_PROMPT);
    toast('success', 'Curation prompt copied — paste it in your IDE');
  }

  const tierColor = tierLevel.value === 'gold' ? 'gold' : tierLevel.value === 'silver' ? 'silver' : 'bronze';

  // Parse tier output into pass/fail sections
  const lines = (tierOutput.value || '').split('\n');
  const checks: { label: string; pass: boolean }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('+ ')) checks.push({ label: trimmed.slice(2), pass: true });
    else if (trimmed.startsWith('- ')) checks.push({ label: trimmed.slice(2), pass: false });
  }
  const failing = checks.filter(c => !c.pass);
  const passing = checks.filter(c => c.pass);

  return (
    <div>
      <InfoCard title="Curate to Gold" storageKey="curate-step-info">
        Your Bronze <ConceptTerm term="semanticPlane" definition={CONCEPTS.semanticPlane.definition}>{CONCEPTS.semanticPlane.label}</ConceptTerm> is scaffolded.
        To reach Gold, have your AI agent in Claude Code, Cursor, or Copilot curate the metadata using real data.
        The agent connects via MCP, queries your database, and writes meaningful descriptions, rules, and queries.
      </InfoCard>

      {/* Workflow steps */}
      <h2 class="connect-heading">Agent-Driven Curation</h2>
      <p class="muted" style={{ marginBottom: '20px' }}>Your AI agent does the heavy lifting — it queries your data and writes Gold-quality metadata.</p>

      <div class="curate-workflow">
        <div class="curate-step">
          <div class="curate-step-num">1</div>
          <div class="curate-step-content">
            <h4>Add MCP Config to Your IDE</h4>
            <p class="muted">Copy this into your IDE's MCP settings (Claude Desktop, Cursor, etc.)</p>
            {mcpConfig.value && (
              <div style={{ marginTop: '8px' }}>
                <CodeBlock code={mcpConfig.value} />
                <Button variant="secondary" size="sm" onClick={() => {
                  navigator.clipboard.writeText(mcpConfig.value || '');
                  toast('success', 'Copied MCP config');
                }} style={{ marginTop: '8px' }}>Copy Config</Button>
              </div>
            )}
          </div>
        </div>

        <div class="curate-step">
          <div class="curate-step-num">2</div>
          <div class="curate-step-content">
            <h4>Start a Curation Session</h4>
            <p class="muted">Paste this prompt in your IDE chat to start curating to Gold:</p>
            <div class="curate-prompt-block">
              <div class="curate-prompt-text">{CURATION_PROMPT}</div>
              <Button variant="primary" size="sm" onClick={copyPrompt} style={{ marginTop: '8px' }}>Copy Curation Prompt</Button>
            </div>
          </div>
        </div>

        <div class="curate-step">
          <div class="curate-step-num">3</div>
          <div class="curate-step-content">
            <h4>Check Your Progress</h4>
            <p class="muted">After your agent works, check the tier scorecard here or via <code>context tier</code>.</p>
            <Button variant="secondary" size="sm" onClick={refreshTier} style={{ marginTop: '8px' }}>
              Refresh Tier Score
            </Button>
          </div>
        </div>
      </div>

      {/* Tier scorecard */}
      {tierOutput.value && (
        <div class="curate-scorecard">
          <div class="curate-scorecard-header">
            <h3>Tier Scorecard</h3>
            <Badge variant={tierColor}>{tierLevel.value.toUpperCase()}</Badge>
          </div>

          {failing.length > 0 && (
            <div class="curate-checks-section">
              <div class="curate-checks-label">Failing ({failing.length})</div>
              {failing.map((c, i) => (
                <div class="curate-check fail" key={i}>
                  <span class="curate-check-icon">✗</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </div>
          )}

          {passing.length > 0 && (
            <details class="curate-checks-section">
              <summary class="curate-checks-label">Passing ({passing.length})</summary>
              {passing.map((c, i) => (
                <div class="curate-check pass" key={i}>
                  <span class="curate-check-icon">✓</span>
                  <span>{c.label}</span>
                </div>
              ))}
            </details>
          )}
        </div>
      )}

      {/* Agent instructions toggle */}
      <div style={{ marginTop: '20px' }}>
        {!showInstructions.value && (
          <Button variant="secondary" size="sm" onClick={loadInstructions}>View Full Agent Instructions</Button>
        )}
        {showInstructions.value && agentInstructions.value && (
          <details open class="curate-instructions">
            <summary>Agent Instructions</summary>
            <div class="curate-instructions-content">
              <pre>{agentInstructions.value}</pre>
            </div>
            <Button variant="secondary" size="sm" onClick={() => {
              navigator.clipboard.writeText(agentInstructions.value || '');
              toast('success', 'Agent instructions copied');
            }} style={{ marginTop: '8px' }}>Copy Instructions</Button>
          </details>
        )}
      </div>

      {/* Navigation */}
      <div class="step-actions">
        <Button variant="secondary" onClick={() => { currentStep.value = currentStep.value - 1; }}>Back</Button>
        <Button onClick={() => { currentStep.value = 6; }}>
          {tierLevel.value === 'gold' ? 'Continue to Serve' : 'Skip to Serve'}
        </Button>
      </div>
    </div>
  );
}
