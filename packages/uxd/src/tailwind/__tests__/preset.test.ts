import { describe, it, expect } from 'vitest';
import { runcontextPreset } from '../preset.js';

describe('tailwind preset', () => {
  it('exports a valid preset object with theme', () => {
    expect(runcontextPreset).toHaveProperty('theme');
    expect(runcontextPreset.theme).toHaveProperty('extend');
  });
  it('maps brand gold to tailwind color', () => {
    const colors = runcontextPreset.theme!.extend!.colors as Record<string, unknown>;
    expect(colors['brand-gold']).toBe('#c9a55a');
  });
  it('maps surface colors', () => {
    const colors = runcontextPreset.theme!.extend!.colors as Record<string, unknown>;
    expect(colors['surface-bg']).toBe('#0a0908');
    expect(colors['surface-card']).toBe('#121110');
  });
  it('maps font families', () => {
    const fonts = runcontextPreset.theme!.extend!.fontFamily as Record<string, unknown>;
    expect(fonts.sans).toContain("'Plus Jakarta Sans'");
    expect(fonts.mono).toContain("'Geist Mono'");
  });
});
