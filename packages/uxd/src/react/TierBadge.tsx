import type { HTMLAttributes } from 'react';
import { Badge } from './Badge.js';

const tierLabels = {
  gold: 'AI-Ready',
  silver: 'Trusted',
  bronze: 'Discoverable',
} as const;

export interface TierBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tier: 'gold' | 'silver' | 'bronze';
}

export function TierBadge({ tier, ...props }: TierBadgeProps) {
  return (
    <Badge variant={tier} {...props}>
      {tierLabels[tier]}
    </Badge>
  );
}
