import { signal } from '@preact/signals';
import { Button, TierBadge, CodeBlock, useToast } from '@runcontext/uxd/react';
import { api } from '../api';
import { currentStep, brief } from '../state';

const tier = signal<'bronze' | 'silver' | 'gold'>('bronze');
const mcpConfig = signal<string | null>(null);
const mcpRunning = signal(false);
const mcpLoading = signal(false);
const tierLoaded = signal(false);

function updateSidebarMcp(running: boolean) {
  const dot = document.getElementById('mcp-server-dot');
  const text = document.getElementById('mcp-server-text');
  const navDot = document.getElementById('mcp-status-dot');
  const navText = document.getElementById('mcp-status-text');
  if (dot) { dot.classList.toggle('success', running); dot.classList.toggle('error', !running); }
  if (text) text.textContent = running ? 'MCP running' : 'MCP stopped';
  if (navDot) { navDot.classList.toggle('success', running); }
  if (navText) navText.textContent = running ? 'connected' : 'offline';
}

export function Serve() {
  const { toast } = useToast();

  if (!tierLoaded.value) {
    tierLoaded.value = true;
    // Get tier from the authoritative CLI tier check
    api<{ tier: string }>('GET', '/api/tier').then(data => {
      if (data.tier === 'gold' || data.tier === 'silver' || data.tier === 'bronze') {
        tier.value = data.tier;
      }
    }).catch(() => {});
    api<{ running: boolean }>('GET', '/api/mcp/status').then(data => {
      mcpRunning.value = data.running;
      updateSidebarMcp(data.running);
    }).catch(() => {});
  }

  async function toggleMcp() {
    mcpLoading.value = true;
    try {
      if (mcpRunning.value) {
        await api<any>('POST', '/api/mcp/stop');
        mcpRunning.value = false;
        updateSidebarMcp(false);
        toast('info', 'MCP server stopped');
      } else {
        await api<any>('POST', '/api/mcp/start');
        mcpRunning.value = true;
        updateSidebarMcp(true);
        toast('success', 'MCP server started');
      }
    } catch {
      toast('error', 'Failed to toggle MCP server');
    } finally {
      mcpLoading.value = false;
    }
  }

  async function loadMcpConfig() {
    try {
      const config = await api<any>('GET', '/api/mcp-config');
      mcpConfig.value = JSON.stringify(config, null, 2);
    } catch {
      toast('error', 'Failed to load MCP configuration');
    }
  }

  function startNewPlane() {
    // Reset to step 1 with a fresh session
    window.location.href = '/setup';
  }

  return (
    <div>
      {/* Success hero */}
      <div class="serve-done-hero">
        <div class="serve-done-icon">✓</div>
        <h2 class="serve-done-title">{brief.value.product_name || 'Semantic Plane'} Created</h2>
        <div class="serve-tier-row">
          <TierBadge tier={tier.value} />
        </div>
      </div>

      {/* What's next — clear choices */}
      <h3 class="serve-section-heading">What's Next</h3>
      <div class="serve-next-grid">
        {tier.value !== 'gold' && (
          <div class="serve-next-card" onClick={() => { currentStep.value = 5; }}>
            <div class="serve-next-icon">⬆</div>
            <div>
              <h4>Curate to {tier.value === 'bronze' ? 'Silver' : 'Gold'}</h4>
              <p class="muted">Have your AI agent enrich metadata using real data</p>
            </div>
          </div>
        )}

        <div class="serve-next-card" onClick={toggleMcp}>
          <div class="serve-next-icon">{mcpRunning.value ? '⏹' : '▶'}</div>
          <div>
            <h4>{mcpRunning.value ? 'Stop MCP Server' : 'Start MCP Server'}</h4>
            <p class="muted">{mcpRunning.value ? 'AI agents are connected' : 'Let AI agents query your semantic plane'}</p>
          </div>
        </div>

        <div class="serve-next-card" onClick={() => { window.location.href = '/planes'; }}>
          <div class="serve-next-icon">📊</div>
          <div>
            <h4>View Semantic Planes</h4>
            <p class="muted">Browse tables, rules, and YAML blueprints</p>
          </div>
        </div>

        <div class="serve-next-card" onClick={startNewPlane}>
          <div class="serve-next-icon">+</div>
          <div>
            <h4>New Semantic Plane</h4>
            <p class="muted">Connect another database and scaffold a new plane</p>
          </div>
        </div>
      </div>

      {/* Collapsible extras */}
      <details class="serve-extras">
        <summary>IDE Config & CLI Commands</summary>
        <div class="serve-extras-body">
          <div class="serve-extras-section">
            <h4>MCP Config for Your IDE</h4>
            <p class="muted">Add to Claude Desktop, Cursor, etc.</p>
            {!mcpConfig.value && (
              <Button variant="secondary" size="sm" onClick={loadMcpConfig}>Show Config</Button>
            )}
            {mcpConfig.value && (
              <div>
                <CodeBlock code={mcpConfig.value} />
                <Button variant="secondary" size="sm" onClick={() => {
                  navigator.clipboard.writeText(mcpConfig.value || '');
                  toast('success', 'Copied to clipboard');
                }} style={{ marginTop: '8px' }}>Copy</Button>
              </div>
            )}
          </div>
          <div class="serve-extras-section">
            <h4>CLI Commands</h4>
            <div class="serve-cli-grid">
              {[
                ['context serve', 'Start the MCP server'],
                ['context tier', 'Check current tier'],
                ['context verify', 'Validate semantic plane'],
              ].map(([cmd, desc]) => (
                <div class="serve-cmd-row" key={cmd}>
                  <code class="serve-cmd">{cmd}</code>
                  <span class="serve-cmd-desc">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* Back */}
      <div class="step-actions">
        <Button variant="secondary" onClick={() => { currentStep.value = currentStep.value - 1; }}>Back</Button>
      </div>
    </div>
  );
}
