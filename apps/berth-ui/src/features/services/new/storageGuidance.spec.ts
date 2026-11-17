import { describe, expect, it } from 'vitest';
import { StorageGuidanceRules as Rules } from './storageGuidance';

const base = { managedDatabase: false, appTemplate: false };

describe('StorageGuidanceRules', () => {
  it('treats a repository or image as stateless: storage is optional', () => {
    for (const choice of ['git', 'image', 'empty'] as const) {
      const guidance = Rules.forDeployment({ choice, ...base });
      expect(guidance.mode).toBe('optional');
      expect(guidance.body).toContain('stateless');
    }
  });

  it('sizes databases by engine and requires storage', () => {
    const postgres = Rules.forDeployment({ choice: 'database', templateKind: 'postgres', managedDatabase: true, appTemplate: false });
    const redis = Rules.forDeployment({ choice: 'database', templateKind: 'redis', managedDatabase: true, appTemplate: false });
    expect(postgres).toMatchObject({ mode: 'managed', defaultGb: 5 });
    expect(redis.defaultGb).toBe(1);
  });

  it('gives buckets more room by default', () => {
    expect(Rules.forDeployment({ choice: 'bucket', ...base })).toMatchObject({ mode: 'managed', defaultGb: 10 });
  });

  it('keeps app templates small', () => {
    expect(Rules.forDeployment({ choice: 'template', managedDatabase: false, appTemplate: true }).defaultGb).toBe(2);
  });

  it('always offers sensible presets that include the default', () => {
    for (const input of [
      { choice: 'git' as const, ...base },
      { choice: 'bucket' as const, ...base },
      { choice: 'database' as const, templateKind: 'postgres', managedDatabase: true, appTemplate: false },
    ]) {
      const guidance = Rules.forDeployment(input);
      expect(guidance.presets).toContain(guidance.defaultGb);
    }
  });
});
