import type { EnvVar } from '@berth/protocol';

export const SECRET_MASK = '********';
export type EnvFormat = 'dotenv' | 'json';

export interface EnvTextError {
  line?: number;
  message: string;
}

export interface EnvParseResult {
  vars: EnvVar[];
  errors: EnvTextError[];
}

const SECRET_HINT = /(SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|_KEY|APIKEY|PASS)/i;
const KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;

export class EnvText {
  static looksSecret(key: string): boolean {
    return SECRET_HINT.test(key);
  }

  static serialize(rows: EnvVar[], format: EnvFormat, showSecrets: boolean): string {
    const visible = rows.filter((row) => row.key.trim());
    const valueOf = (row: EnvVar) =>
      row.isSecret && !showSecrets ? SECRET_MASK : row.value;

    if (format === 'json') {
      const entries = Object.fromEntries(visible.map((row) => [row.key, valueOf(row)]));
      return JSON.stringify(entries, null, 2);
    }
    return visible
      .map((row) => {
        const value = valueOf(row);
        const needsQuotes = value === '' || /[\s#"']/.test(value);
        return `${row.key}=${needsQuotes ? `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"` : value}`;
      })
      .join('\n');
  }

  static parse(text: string, format: EnvFormat, existing: EnvVar[]): EnvParseResult {
    const raw = format === 'json' ? EnvText.parseJson(text) : EnvText.parseDotenv(text);
    const byKey = new Map(existing.filter((row) => row.key.trim()).map((row) => [row.key, row]));
    const errors = [...raw.errors];
    const seen = new Set<string>();
    const vars: EnvVar[] = [];

    for (const entry of raw.entries) {
      if (!KEY_PATTERN.test(entry.key)) {
        errors.push({
          line: entry.line,
          message: `"${entry.key}" is not a valid variable name (letters, digits, _ . - and it cannot start with a digit).`,
        });
        continue;
      }
      if (seen.has(entry.key)) {
        errors.push({ line: entry.line, message: `"${entry.key}" appears more than once.` });
        continue;
      }
      seen.add(entry.key);

      const previous = byKey.get(entry.key);
      if (entry.value === SECRET_MASK) {
        if (!previous) {
          errors.push({
            line: entry.line,
            message: `"${entry.key}" is a new variable, so ${SECRET_MASK} is not a real value.`,
          });
          continue;
        }
        vars.push({ key: entry.key, value: previous.value, isSecret: previous.isSecret });
        continue;
      }
      vars.push({
        key: entry.key,
        value: entry.value,
        isSecret: previous ? previous.isSecret : EnvText.looksSecret(entry.key),
      });
    }
    return { vars, errors };
  }

  private static parseDotenv(text: string) {
    const entries: { key: string; value: string; line: number }[] = [];
    const errors: EnvTextError[] = [];
    text.split(/\r?\n/).forEach((rawLine, index) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return;
      const eq = line.indexOf('=');
      if (eq === -1) {
        errors.push({ line: index + 1, message: 'Expected KEY=value.' });
        return;
      }
      let key = line.slice(0, eq).trim();
      if (key.startsWith('export ')) key = key.slice(7).trim();
      let value = line.slice(eq + 1).trim();
      const quoted =
        value.length >= 2 &&
        ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'")));
      if (quoted) {
        const double = value.startsWith('"');
        value = value.slice(1, -1);
        if (double) value = value.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }
      entries.push({ key, value, line: index + 1 });
    });
    return { entries, errors };
  }

  private static parseJson(text: string) {
    const entries: { key: string; value: string; line?: number }[] = [];
    const errors: EnvTextError[] = [];
    if (!text.trim()) return { entries, errors };

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      errors.push({ message: `Invalid JSON: ${(error as Error).message}` });
      return { entries, errors };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      errors.push({ message: 'Use a JSON object like { "KEY": "value" }.' });
      return { entries, errors };
    }
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (value === null || typeof value === 'object') {
        errors.push({ message: `"${key}" must be a string, number or true/false.` });
        continue;
      }
      entries.push({ key, value: String(value) });
    }
    return { entries, errors };
  }
}
