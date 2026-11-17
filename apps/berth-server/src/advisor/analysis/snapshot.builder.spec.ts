import { describe, expect, it } from 'vitest';
import { SnapshotBuilder } from './snapshot.builder';
import type { RawOrgData } from '../interfaces';

const hostile = {
  id: 'svc-1',
  name: 'api',
  kind: 'git',
  state: 'running',
  sourceKind: 'git',
  image: 'postgres',
  tag: '16',
  replicas: 1,
  cpuCores: 1,
  memoryMb: 512,
  deployStrategy: 'rolling',
  autoRollback: true,
  volumePath: '/data',
  diskGb: 5,
  volumeLimited: true,
  serverId: 'srv-1',
  previewsEnabled: false,
  // none of the following may ever reach the snapshot
  envVars: [{ key: 'DATABASE_URL', value: 'postgres://admin:hunter2@db/prod', isSecret: true }],
  repo: 'https://x-access-token:ghp_SECRET@github.com/acme/private.git',
  registryCredential: { username: 'bob', passwordEncrypted: 'v2:abc:def' },
  specHash: 'deadbeef',
  rollbackCommitSha: 'abc123',
  domain: 'secret-internal.example.com',
  internalDomains: ['api-abc.berth.local'],
  password: 'p@ss',
  token: 'tok_live_123',
  apiKey: 'sk-ant-xyz',
};

const raw = (): RawOrgData => ({
  now: new Date('2026-11-17T12:00:00Z'),
  servers: [{ id: 'srv-1', name: 'edge-1', cpuCores: 4, memoryMb: 8192, diskGb: 100, status: 'online', storageBudgetGb: 25, allocatedDiskGb: 5, bootstrapToken: 'BOOT', certSerial: 'abc' } as never],
  services: [hostile as never],
  metrics: [{ serviceId: 'svc-1', peakCpuPct: 41.234, peakMemMb: 480.66, avgCpuPct: 12.1, avgMemMb: 300.04, samples: 9000 }],
  deployStats: [{ serviceId: 'svc-1', total: 5, failed: 1 }],
  proxyHosts: [{ serviceId: 'svc-1', ssl: true, domain: 'secret-internal.example.com' } as never],
  backupTargets: 1,
  servicesWithBackup: [],
});

describe('SnapshotBuilder privacy boundary', () => {
  const json = JSON.stringify(SnapshotBuilder.build(raw()));

  it('never includes environment variables, secrets or credentials', () => {
    for (const forbidden of [
      'DATABASE_URL', 'hunter2', 'ghp_SECRET', 'x-access-token', 'passwordEncrypted', 'v2:abc', 'p@ss',
      'tok_live_123', 'sk-ant-xyz', 'bootstrapToken', 'BOOT', 'certSerial', 'deadbeef', 'abc123',
      'envVars', 'isSecret', 'registryCredential',
    ]) {
      expect(json, forbidden).not.toContain(forbidden);
    }
  });

  it('does not reveal domain names or repository addresses', () => {
    expect(json).not.toContain('secret-internal');
    expect(json).not.toContain('github.com');
    expect(json).not.toContain('berth.local');
    expect(json).not.toContain('private.git');
  });

  it('keeps only the allowlisted keys on every service and server', () => {
    const snapshot = SnapshotBuilder.build(raw());
    expect(Object.keys(snapshot.services[0]).sort()).toEqual(
      ['autoRollback', 'cpuCores', 'deployStrategy', 'deployments7d', 'domains', 'hasBackup', 'id', 'kind', 'memoryMb', 'name', 'replicas', 'serverId', 'source', 'state', 'storage', 'usage'].sort(),
    );
    expect(Object.keys(snapshot.servers[0]).sort()).toEqual(['cpuCores', 'diskGb', 'id', 'memoryMb', 'name', 'status', 'storage'].sort());
  });

  it('still carries what the advisor needs', () => {
    const [service] = SnapshotBuilder.build(raw()).services;
    expect(service.usage).toEqual({ peakMemMb: 480.7, avgMemMb: 300, peakCpuPct: 41.2, avgCpuPct: 12.1, samples: 9000 });
    expect(service.storage).toEqual({ mounted: true, sizeGb: 5, limited: true });
    expect(service.domains).toEqual({ count: 1, allHttps: true });
    expect(service.source).toEqual({ kind: 'git', image: 'postgres', tag: '16' });
  });

  it('omits usage when there are no samples and reports plain HTTP domains', () => {
    const data = raw();
    data.metrics = [];
    data.proxyHosts = [{ serviceId: 'svc-1', ssl: false }];
    const [service] = SnapshotBuilder.build(data).services;
    expect(service.usage).toBeUndefined();
    expect(service.domains.allHttps).toBe(false);
  });
});
