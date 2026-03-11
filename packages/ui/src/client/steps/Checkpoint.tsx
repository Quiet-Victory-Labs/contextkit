import { Button, Card, TierBadge } from '@runcontext/uxd/react';
import { currentStep } from '../state';

export function Checkpoint() {
  return (
    <Card className="checkpoint-card">
      <h2>Bronze Tier Achieved</h2>

      <div class="tier-scorecard">
        <div class="tier-row achieved">
          <TierBadge tier="bronze" />
          <span class="tier-desc">Schema metadata, table/column names, types, row counts</span>
        </div>
        <div class="tier-row">
          <span class="tier-label">Silver</span>
          <span class="tier-desc">Column descriptions, sample values, trust tags</span>
        </div>
        <div class="tier-row">
          <span class="tier-label">Gold</span>
          <span class="tier-desc">Join rules, grain statements, semantic roles, golden queries, guardrail filters</span>
        </div>
      </div>

      <p class="checkpoint-explain">
        Your semantic plane has basic schema metadata. AI tools can use this now, but with Gold tier they will understand join relationships, business descriptions, and query patterns.
      </p>

      <div class="checkpoint-ctas">
        <Button variant="secondary" onClick={() => { currentStep.value = 6; }}>Start MCP Server</Button>
        <Button onClick={() => { currentStep.value = 5; }}>Continue to Gold</Button>
      </div>
    </Card>
  );
}
