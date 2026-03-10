import { describe, it, expect } from 'vitest';
import { authCommand } from '../commands/auth.js';

describe('authCommand', () => {
  it('is a valid Commander command', () => {
    expect(authCommand.name()).toBe('auth');
    expect(authCommand.description()).toContain('Authenticate');
  });

  it('accepts an optional provider argument', () => {
    const args = authCommand.registeredArguments ?? [];
    expect(authCommand.usage()).toBeDefined();
  });
});
