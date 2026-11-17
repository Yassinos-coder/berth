import { describe, expect, it } from 'vitest';
import { FindingActionValidator as V } from './finding-action.validator';

const context = { serviceExists: (id: string) => id === 'svc-1' };

describe('FindingActionValidator', () => {
  it('parses the three whitelisted actions', () => {
    expect(V.parse({ type: 'set-resources', serviceId: 's', memoryMb: 1024 })).toEqual({ type: 'set-resources', serviceId: 's', memoryMb: 1024 });
    expect(V.parse({ type: 'set-disk-size', serviceId: 's', diskGb: 10 })).toEqual({ type: 'set-disk-size', serviceId: 's', diskGb: 10 });
    expect(V.parse({ type: 'enable-auto-rollback', serviceId: 's' })).toEqual({ type: 'enable-auto-rollback', serviceId: 's' });
  });

  it('rejects anything that is not on the whitelist, however it is dressed up', () => {
    for (const bad of [
      { type: 'delete-service', serviceId: 's' },
      { type: 'run-command', serviceId: 's', command: 'rm -rf /' },
      { type: 'set-env', serviceId: 's', key: 'A', value: 'b' },
      { type: 'set-resources' },
      { serviceId: 's' },
      null,
      'set-resources',
      42,
    ]) {
      expect(V.parse(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('drops extra fields so a model cannot smuggle parameters through', () => {
    const parsed = V.parse({ type: 'set-resources', serviceId: 's', memoryMb: 512, env: { A: '1' }, command: 'x' });
    expect(parsed).toEqual({ type: 'set-resources', serviceId: 's', memoryMb: 512 });
  });

  it('requires sane numbers', () => {
    expect(V.parse({ type: 'set-resources', serviceId: 's', memoryMb: 512.5 })).toBeNull();
    expect(V.parse({ type: 'set-resources', serviceId: 's', cpuCores: 'lots' })).toBeNull();
    expect(V.parse({ type: 'set-disk-size', serviceId: 's', diskGb: 1.5 })).toBeNull();
    expect(V.parse({ type: 'set-resources', serviceId: 's', cpuCores: NaN })).toBeNull();
  });

  it('enforces hard bounds before anything is applied', () => {
    expect(V.validate({ type: 'set-resources', serviceId: 'svc-1', memoryMb: 100000000 }, context).error).toContain('Memory must be');
    expect(V.validate({ type: 'set-resources', serviceId: 'svc-1', memoryMb: 10 }, context).error).toContain('Memory must be');
    expect(V.validate({ type: 'set-resources', serviceId: 'svc-1', cpuCores: 500 }, context).error).toContain('CPU must be');
    expect(V.validate({ type: 'set-disk-size', serviceId: 'svc-1', diskGb: 99999 }, context).error).toContain('Storage must be');
  });

  it('refuses an action for a service that is gone', () => {
    expect(V.validate({ type: 'enable-auto-rollback', serviceId: 'gone' }, context).error).toContain('no longer exists');
  });

  it('accepts a good action', () => {
    expect(V.validate({ type: 'set-resources', serviceId: 'svc-1', memoryMb: 2048 }, context).action).toEqual({ type: 'set-resources', serviceId: 'svc-1', memoryMb: 2048 });
  });

  it('describes an action in plain words', () => {
    expect(V.describe({ type: 'set-resources', serviceId: 's', memoryMb: 1024 }, 'api', { cpuCores: 1, memoryMb: 512 })).toBe('Change api: memory 512 MB → 1024 MB');
    expect(V.describe({ type: 'enable-auto-rollback', serviceId: 's' }, 'api')).toBe('Turn on automatic rollback for api');
    expect(V.describe({ type: 'set-disk-size', serviceId: 's', diskGb: 10 }, 'db', { cpuCores: 1, memoryMb: 1, diskGb: 5 })).toBe("Set db's storage to 10 GB (now 5 GB)");
  });
});
