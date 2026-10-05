import type { EnvEntry } from '@/interfaces';

const ANSI_SGR = /(?:\u001b|�)\[[0-9;]*m/g;

export class FormatUtil {
  static table(headers: string[], rows: string[][]): string {
    const widths = headers.map((header, column) =>
      Math.max(header.length, ...rows.map((row) => (row[column] ?? '').length)),
    );
    const render = (cells: string[]) =>
      cells.map((cell, column) => cell.padEnd(widths[column])).join('  ').trimEnd();
    return [render(headers), ...rows.map(render)].join('\n');
  }

  static cleanLog(line: string): string {
    return line.replace(ANSI_SGR, '').replace(/\r/g, '');
  }

  static maskSecrets(env: EnvEntry[]): EnvEntry[] {
    return env.map((entry) => (entry.isSecret ? { ...entry, value: '********' } : entry));
  }

  static parseAssignment(assignment: string): { key: string; value: string } {
    const split = assignment.indexOf('=');
    if (split <= 0) throw new Error(`Expected KEY=value, got "${assignment}"`);
    return { key: assignment.slice(0, split).trim(), value: assignment.slice(split + 1) };
  }

  static normalizeUrl(url: string): string {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(trimmed)) throw new Error('URL must start with http:// or https://');
    return trimmed.replace(/\/api$/, '');
  }
}
