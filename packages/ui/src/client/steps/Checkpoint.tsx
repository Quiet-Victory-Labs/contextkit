import { Button, Card, ConceptTerm, InfoCard, TierBadge } from '@runcontext/uxd/react';
import { CONCEPTS } from '../concepts';
import { currentStep } from '../state';

export function Checkpoint() {
  return (
    <Card className="checkpoint-card">
      <InfoCard title="What's Next?" storageKey="checkpoint-info">
        You can start your MCP server now with Bronze context, or continue to Gold for full AI comprehension including join rules, business descriptions, and query patterns.
      </InfoCard>

      <h2>Bronze Tier Achieved</h2>

      <div class="tier-scorecard">
        <div class="tier-row achieved">
          <TierBadge tier="bronze" />
          <ConceptTerm term="bronzeTier" definition={CONCEPTS.bronzeTier.definition}>{CONCEPTS.bronzeTier.label}</ConceptTerm>
          <span class="tier-desc">Schema metadata, table/column names, types, row counts</span>
        </div>
        <div class="tier-row">
          <ConceptTerm term="silverTier" definition={CONCEPTS.silverTier.definition}>{CONCEPTS.silverTier.label}</ConceptTerm>
          <span class="tier-desc">Column descriptions, sample values, trust tags</span>
        </div>
        <div class="tier-row">
          <ConceptTerm term="goldTier" definition={CONCEPTS.goldTier.definition}>{CONCEPTS.goldTier.label}</ConceptTerm>
          <span class="tier-desc">Join rules, grain statements, semantic roles, golden queries, guardrail filters</span>
        </div>
      </div>

      <p class="checkpoint-explain">
        Your <ConceptTerm term="semanticPlane" definition={CONCEPTS.semanticPlane.definition}>{CONCEPTS.semanticPlane.label}</ConceptTerm> has basic schema metadata. AI tools can use this now, but with Gold tier they will understand join relationships, business descriptions, and query patterns.
      </p>

      <div class="checkpoint-ctas">
        <Button variant="secondary" onClick={() => { currentStep.value = 6; }}>Start <ConceptTerm term="mcpEndpoint" definition={CONCEPTS.mcpEndpoint.definition}>{CONCEPTS.mcpEndpoint.label}</ConceptTerm> Server</Button>
        <Button onClick={() => { currentStep.value = 5; }}>Continue to Gold</Button>
      </div>
    </Card>
  );
}
