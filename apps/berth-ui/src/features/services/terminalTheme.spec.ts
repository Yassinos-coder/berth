import { describe, expect, it } from 'vitest';
import { TERMINAL_FONT_FAMILY, TERMINAL_OPTIONS, TerminalKeys } from './terminalTheme';

describe('terminal options', () => {
  it('uses a real font stack, because xterm cannot resolve CSS variables', () => {
    expect(TERMINAL_FONT_FAMILY).not.toContain('var(');
    expect(TERMINAL_FONT_FAMILY.trim().endsWith('monospace')).toBe(true);
  });

  it('keeps line spacing generous enough that descenders are not clipped', () => {
    expect(TERMINAL_OPTIONS.lineHeight).toBeGreaterThanOrEqual(1.2);
    expect(TERMINAL_OPTIONS.fontSize).toBeGreaterThanOrEqual(13);
  });
});

describe('TerminalKeys', () => {
  const key = (init: Partial<Parameters<typeof TerminalKeys.isCopy>[0]>) => ({
    type: 'keydown',
    key: '',
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    ...init,
  });

  it('copies on Ctrl+Shift+C and Cmd+Shift+C only', () => {
    expect(TerminalKeys.isCopy(key({ key: 'C', ctrlKey: true, shiftKey: true }))).toBe(true);
    expect(TerminalKeys.isCopy(key({ key: 'c', metaKey: true, shiftKey: true }))).toBe(true);
  });

  it('leaves Ctrl+C alone so it still interrupts the running process', () => {
    expect(TerminalKeys.isCopy(key({ key: 'c', ctrlKey: true }))).toBe(false);
  });
});
