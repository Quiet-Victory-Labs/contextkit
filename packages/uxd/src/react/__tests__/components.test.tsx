import { describe, it, expect } from 'vitest';
import { Button, Card, StatCard, Badge, TierBadge, Input, Textarea, Select, ActivityFeed, EmptyState, Spinner, ErrorCard, CodeBlock } from '../index.js';

describe('react component exports', () => {
  it('exports Button', () => expect(Button).toBeDefined());
  it('exports Card', () => expect(Card).toBeDefined());
  it('exports StatCard', () => expect(StatCard).toBeDefined());
  it('exports Badge', () => expect(Badge).toBeDefined());
  it('exports TierBadge', () => expect(TierBadge).toBeDefined());
  it('exports Input', () => expect(Input).toBeDefined());
  it('exports Textarea', () => expect(Textarea).toBeDefined());
  it('exports Select', () => expect(Select).toBeDefined());
  it('exports ActivityFeed', () => expect(ActivityFeed).toBeDefined());
  it('exports EmptyState', () => expect(EmptyState).toBeDefined());
  it('exports Spinner', () => expect(Spinner).toBeDefined());
  it('exports ErrorCard', () => expect(ErrorCard).toBeDefined());
  it('exports CodeBlock', () => expect(CodeBlock).toBeDefined());
});
