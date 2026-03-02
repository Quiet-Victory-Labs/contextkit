import { describe, it, expect } from 'vitest';
import {
  conceptFileSchema,
  productFileSchema,
  policyFileSchema,
  ownerFileSchema,
} from '../index.js';

describe('Zod Schemas', () => {
  it('parses a complete valid concept', () => {
    const input = {
      id: 'concept/churn-rate',
      name: 'Churn Rate',
      domain: 'retention',
      product_id: 'product/dashboard',
      definition: 'The percentage of customers who stop using a product over a given period.',
      owner: 'analytics-team',
      status: 'certified' as const,
      certified: true,
      tags: ['metrics', 'retention'],
      evidence: [{ type: 'doc', ref: 'https://example.com/churn' }],
      depends_on: ['concept/customer', 'concept/subscription'],
      examples: [
        { label: 'Correct usage', content: 'Monthly churn rate was 3%.', kind: 'do' as const },
        { label: 'Incorrect usage', content: 'Churn means any cancellation.', kind: 'dont' as const },
      ],
      description: 'Measures customer attrition.',
    };

    const result = conceptFileSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('concept/churn-rate');
      expect(result.data.definition).toContain('percentage');
      expect(result.data.examples).toHaveLength(2);
      expect(result.data.depends_on).toHaveLength(2);
    }
  });

  it('fails validation when concept is missing definition', () => {
    const input = {
      id: 'concept/broken',
      owner: 'team-a',
    };

    const result = conceptFileSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.issues.map((i) => i.path[0]);
      expect(fieldErrors).toContain('definition');
    }
  });

  it('parses a complete valid product', () => {
    const input = {
      id: 'product/dashboard',
      name: 'Analytics Dashboard',
      description: 'Analytics dashboard for tracking key business metrics.',
      owner: 'product-team',
      tags: ['analytics'],
      status: 'certified' as const,
    };

    const result = productFileSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('product/dashboard');
      expect(result.data.description).toContain('Analytics');
    }
  });

  it('parses a policy with rules', () => {
    const input = {
      id: 'policy/certified-only',
      description: 'Only certified concepts may be used in production.',
      rules: [
        {
          priority: 1,
          when: { status: 'draft' },
          then: { deny: true, warn: 'Draft concepts cannot be used in production.' },
        },
        {
          priority: 2,
          when: { tags_any: ['deprecated'] },
          then: { warn: 'This concept is deprecated and should be replaced.' },
        },
      ],
    };

    const result = policyFileSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rules).toHaveLength(2);
      expect(result.data.rules[0]!.priority).toBe(1);
      expect(result.data.rules[0]!.then.deny).toBe(true);
    }
  });

  it('parses an owner with all fields', () => {
    const input = {
      id: 'owner/analytics-team',
      display_name: 'Analytics Team',
      email: 'analytics@example.com',
      team: 'data',
      tags: ['platform', 'core'],
    };

    const result = ownerFileSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.display_name).toBe('Analytics Team');
      expect(result.data.email).toBe('analytics@example.com');
      expect(result.data.team).toBe('data');
      expect(result.data.tags).toEqual(['platform', 'core']);
    }
  });
});
