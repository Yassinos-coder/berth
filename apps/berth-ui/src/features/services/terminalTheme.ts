import type { ITerminalOptions, ITheme } from '@xterm/xterm';

export const TERMINAL_FONT_FAMILY =
  "'JetBrains Mono', 'Cascadia Mono', 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace";

export const TERMINAL_THEME: ITheme = {
  background: '#0b0d12',
  foreground: '#e6e8ee',
  cursor: '#22b8cf',
  cursorAccent: '#0b0d12',
  selectionBackground: 'rgba(34, 184, 207, 0.35)',
  black: '#1a1d26',
  red: '#ff6b6b',
  green: '#51cf66',
  yellow: '#fcc419',
  blue: '#74a7ff',
  magenta: '#da77f2',
  cyan: '#22b8cf',
  white: '#e6e8ee',
  brightBlack: '#6c7283',
  brightRed: '#ff8787',
  brightGreen: '#8ce99a',
  brightYellow: '#ffe066',
  brightBlue: '#a5c7ff',
  brightMagenta: '#e599f7',
  brightCyan: '#66d9e8',
  brightWhite: '#ffffff',
};

export const TERMINAL_OPTIONS: ITerminalOptions = {
  fontFamily: TERMINAL_FONT_FAMILY,
  fontSize: 14,
  lineHeight: 1.3,
  letterSpacing: 0,
  fontWeight: '400',
  fontWeightBold: '700',
  cursorBlink: true,
  cursorStyle: 'bar',
  scrollback: 10_000,
  scrollOnUserInput: true,
  macOptionIsMeta: true,
  smoothScrollDuration: 0,
  theme: TERMINAL_THEME,
};

export class TerminalKeys {
  static isCopy(
    event: Pick<KeyboardEvent, 'type' | 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey'>,
  ): boolean {
    return (
      event.type === 'keydown' &&
      event.key.toLowerCase() === 'c' &&
      event.shiftKey &&
      (event.ctrlKey || event.metaKey)
    );
  }
}
