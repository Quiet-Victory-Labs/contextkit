import { signal } from '@preact/signals';
import { Card, StatCard, Skeleton, InfoCard, ConceptTerm } from '@runcontext/uxd/react';
import { api } from '../api';
import { CONCEPTS } from '../concepts';

interface LocalStats {
  planes: number;
  tables: number;
  columns: number;
  tier: string;
}

const stats = signal<LocalStats | null>(null);
const loading = signal(true);
const loaded = signal(false);

async function loadStats() {
  loading.value = true;
  try {
    const products = await api<any[]>('GET', '/api/products');
    let totalTables = 0;
    let totalColumns = 0;
    let bestTier = 'none';
    for (const p of products) {
      totalTables += p.tables || 0;
      totalColumns += p.columns || 0;
      if (p.tier === 'gold') bestTier = 'gold';
      else if (p.tier === 'silver' && bestTier !== 'gold') bestTier = 'silver';
      else if (p.tier === 'bronze' && bestTier === 'none') bestTier = 'bronze';
    }
    stats.value = {
      planes: products.length,
      tables: totalTables,
      columns: totalColumns,
      tier: bestTier,
    };
  } catch { /* ignore */ }
  finally { loading.value = false; }
}

export function AnalyticsPage() {
  if (!loaded.value) {
    loaded.value = true;
    loadStats();
  }

  return (
    <div class="analytics-page">
      <InfoCard title="Context Layer Analytics" storageKey="analytics-page-info">
        View metrics about your local <ConceptTerm term="contextLayer" definition={CONCEPTS.contextLayer.definition}>{CONCEPTS.contextLayer.label}</ConceptTerm>.
        For API usage analytics, team activity, and query insights, upgrade to RunContext Cloud.
      </InfoCard>

      {loading.value ? (
        <div class="stats-grid">
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
          <Skeleton variant="stat" />
        </div>
      ) : stats.value ? (
        <div class="stats-grid">
          <StatCard label="Semantic Planes" value={String(stats.value.planes)} />
          <StatCard label="Tables" value={String(stats.value.tables)} />
          <StatCard label="Columns" value={String(stats.value.columns)} />
          <StatCard label="Best Tier" value={stats.value.tier.charAt(0).toUpperCase() + stats.value.tier.slice(1)} />
        </div>
      ) : (
        <p class="muted">No data available. Complete the setup wizard first.</p>
      )}

      <div class="gated-section">
        <h3 class="gated-title">Cloud Analytics</h3>
        <div class="gated-features">
          <Card>
            <div class="gated-feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-text-secondary)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <h4>API Usage</h4>
              <p class="muted">Track MCP endpoint calls, latency, and error rates.</p>
            </div>
          </Card>
          <Card>
            <div class="gated-feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-text-secondary)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <h4>Team Activity</h4>
              <p class="muted">See who's editing planes and when changes were made.</p>
            </div>
          </Card>
          <Card>
            <div class="gated-feature">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--rc-color-text-secondary)" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
              <h4>Query Insights</h4>
              <p class="muted">Understand how AI agents use your context layer.</p>
            </div>
          </Card>
        </div>
        <div class="gated-cta">
          <a href="https://runcontext.dev/pricing" target="_blank" rel="noopener" class="rc-btn rc-btn--primary">
            Unlock Cloud Analytics →
          </a>
        </div>
      </div>
    </div>
  );
}
