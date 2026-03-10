import { describe, it, expect } from 'vitest';
import { colors, typography, spacing, radii, shadows } from '../index.js';

describe('design tokens', () => {
  it('exports brand gold color', () => {
    expect(colors.brand.gold).toBe('#c9a55a');
  });
  it('exports all surface colors', () => {
    expect(colors.surface.bg).toBe('#0a0908');
    expect(colors.surface.card).toBe('#121110');
    expect(colors.surface.cardHover).toBe('#1e1c18');
  });
  it('exports all border colors', () => {
    expect(colors.border.default).toBe('#36342e');
    expect(colors.border.hover).toBe('#6a675e');
  });
  it('exports all text colors', () => {
    expect(colors.text.primary).toBe('#e8e6e1');
    expect(colors.text.secondary).toBe('#9a978e');
    expect(colors.text.muted).toBe('#6a675e');
  });
  it('exports tier colors', () => {
    expect(colors.tier.gold).toBe('#c9a55a');
    expect(colors.tier.silver).toBe('#a0a8b8');
    expect(colors.tier.bronze).toBe('#b87a4a');
  });
  it('exports status colors', () => {
    expect(colors.status.success).toBe('#22c55e');
    expect(colors.status.error).toBe('#ef4444');
    expect(colors.status.warning).toBe('#eab308');
    expect(colors.status.info).toBe('#4f9eff');
  });
  it('exports font families', () => {
    expect(typography.fontFamily.sans).toContain('Plus Jakarta Sans');
    expect(typography.fontFamily.mono).toContain('Geist Mono');
  });
  it('exports font sizes', () => {
    expect(typography.fontSize.base).toBe('1rem');
    expect(typography.fontSize.sm).toBe('0.875rem');
  });
  it('exports spacing values on 4px grid', () => {
    expect(spacing[1]).toBe('0.25rem');
    expect(spacing[2]).toBe('0.5rem');
    expect(spacing[4]).toBe('1rem');
  });
  it('exports border radii', () => {
    expect(radii.sm).toBe('4px');
    expect(radii.md).toBe('8px');
    expect(radii.lg).toBe('12px');
    expect(radii.full).toBe('9999px');
  });
  it('exports shadows', () => {
    expect(shadows.sm).toContain('rgba');
    expect(shadows.md).toContain('rgba');
    expect(shadows.lg).toContain('rgba');
  });
});
