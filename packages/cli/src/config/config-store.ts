import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import type { BerthConfig } from '@/interfaces';

export class ConfigStore {
  static path(): string {
    const base = process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config');
    return join(base, 'berth', 'config.json');
  }

  static load(): BerthConfig {
    const stored = this.read();
    const url = process.env.BERTH_URL ?? stored?.url;
    const token = process.env.BERTH_TOKEN ?? stored?.token;
    if (!url || !token) {
      throw new Error('Not logged in. Run `berth login --url <panel-url> --token <berth_...>`.');
    }
    return { url, token };
  }

  static save(config: BerthConfig): void {
    const file = this.path();
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(config, null, 2), { mode: 0o600 });
    try {
      chmodSync(file, 0o600);
    } catch {
      return;
    }
  }

  private static read(): BerthConfig | null {
    const file = this.path();
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as BerthConfig;
    } catch {
      return null;
    }
  }
}
