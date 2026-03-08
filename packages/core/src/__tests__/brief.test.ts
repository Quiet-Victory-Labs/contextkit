import { describe, it, expect } from 'vitest';
import { validateBrief, type ContextBrief } from '../types/brief.js';

describe('validateBrief', () => {
  it('accepts a valid brief', () => {
    const brief: ContextBrief = {
      product_name: 'player-engagement',
      description: 'Player engagement metrics for live service games.',
      owner: { name: 'Tyler', team: 'Analytics', email: 'tyler@co.com' },
      sensitivity: 'internal',
      data_source: 'snowflake_prod',
      docs: [],
      created_at: new Date().toISOString(),
    };
    expect(validateBrief(brief)).toEqual({ ok: true });
  });

  it('rejects brief with missing product_name', () => {
    const result = validateBrief({
      description: 'Some data',
      owner: { name: 'T', team: 'A', email: 'a@b.com' },
      sensitivity: 'internal',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects brief with invalid sensitivity', () => {
    const result = validateBrief({
      product_name: 'test',
      description: 'Some data',
      owner: { name: 'T', team: 'A', email: 'a@b.com' },
      sensitivity: 'top-secret',
    });
    expect(result.ok).toBe(false);
  });

  it('rejects brief with invalid product_name characters', () => {
    const result = validateBrief({
      product_name: 'has spaces and !@#',
      description: 'Some data',
      owner: { name: 'T', team: 'A', email: 'a@b.com' },
      sensitivity: 'internal',
    });
    expect(result.ok).toBe(false);
  });

  it('accepts brief without optional fields', () => {
    const result = validateBrief({
      product_name: 'minimal',
      description: 'Minimal brief',
      owner: { name: 'T', team: 'A', email: 'a@b.com' },
      sensitivity: 'public',
    });
    expect(result).toEqual({ ok: true });
  });
});
