import { signal } from '@preact/signals';
import { Card, Button, Input, InfoCard, ConceptTerm, ConfirmModal, useToast } from '@runcontext/uxd/react';
import { CONCEPTS } from '../concepts';

const showResetModal = signal(false);

export function SettingsPage() {
  const { toast } = useToast();

  function handleReset() {
    sessionStorage.removeItem('runcontext_wizard_state');
    // Clear all info card dismissals
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('rc-info-dismissed:')) {
        localStorage.removeItem(key);
      }
    }
    toast('success', 'Wizard state cleared');
    showResetModal.value = false;
    window.location.href = '/setup';
  }

  function handleShowTips() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.startsWith('rc-info-dismissed:')) {
        localStorage.removeItem(key);
      }
    }
    toast('success', 'All info cards re-enabled');
  }

  return (
    <div class="settings-page">
      <InfoCard title="Settings" storageKey="settings-page-info">
        Configure your local RunContext instance. For team settings, API keys, and billing, use RunContext Cloud.
      </InfoCard>

      <Card>
        <h3>Local Configuration</h3>

        <div class="settings-section">
          <div class="setting-row">
            <div class="setting-info">
              <label>MCP Server Port</label>
              <p class="muted">The port your <ConceptTerm term="mcpEndpoint" definition={CONCEPTS.mcpEndpoint.definition}>{CONCEPTS.mcpEndpoint.label}</ConceptTerm> runs on.</p>
            </div>
            <div class="setting-value">
              <Input value="3333" disabled />
              <p class="hint">Configure via CLI: <code>context serve --port 8080</code></p>
            </div>
          </div>

          <div class="setting-row">
            <div class="setting-info">
              <label>Show Tips</label>
              <p class="muted">Re-enable all dismissed info cards and tooltips.</p>
            </div>
            <div class="setting-value">
              <Button variant="secondary" size="sm" onClick={handleShowTips}>Show All Tips</Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 class="danger-heading">Danger Zone</h3>

        <div class="settings-section">
          <div class="setting-row">
            <div class="setting-info">
              <label>Reset Wizard</label>
              <p class="muted">Clear all wizard progress and start over. Your semantic plane files on disk are not affected.</p>
            </div>
            <div class="setting-value">
              <Button variant="danger" size="sm" onClick={() => { showResetModal.value = true; }}>
                Reset Wizard
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div class="gated-section">
        <h3 class="gated-title">Cloud Settings</h3>
        <div class="gated-features">
          <Card>
            <div class="gated-feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-text-secondary)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <h4>API Keys</h4>
              <p class="muted">Create and manage API keys for programmatic access.</p>
            </div>
          </Card>
          <Card>
            <div class="gated-feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-text-secondary)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <h4>Team Management</h4>
              <p class="muted">Invite team members, assign roles, and manage access.</p>
            </div>
          </Card>
          <Card>
            <div class="gated-feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-text-secondary)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <h4>Billing</h4>
              <p class="muted">Manage your subscription and view usage.</p>
            </div>
          </Card>
        </div>
        <div class="gated-cta">
          <a href="https://runcontext.dev/pricing" target="_blank" rel="noopener" class="rc-btn rc-btn--primary">
            Get RunContext Cloud →
          </a>
        </div>
      </div>

      <ConfirmModal
        open={showResetModal.value}
        title="Reset Wizard"
        description="This will clear all wizard progress including your database connection, brief, and pipeline state. Your semantic plane files on disk are not affected."
        confirmLabel="Reset"
        variant="danger"
        onConfirm={handleReset}
        onCancel={() => { showResetModal.value = false; }}
      />
    </div>
  );
}
