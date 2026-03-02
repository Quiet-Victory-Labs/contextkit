export type MetadataTier = 'none' | 'bronze' | 'silver' | 'gold';

export interface TierCheckResult {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface TierScore {
  model: string;
  tier: MetadataTier;
  bronze: { passed: boolean; checks: TierCheckResult[] };
  silver: { passed: boolean; checks: TierCheckResult[] };
  gold: { passed: boolean; checks: TierCheckResult[] };
}
