import { describe, expect, it } from 'vitest';
import { RuleEngine } from './rule-engine';
import type { AdvisorSnapshot, SnapshotService } from '../interfaces';

const service = (overrides: Partial<SnapshotService> = {}): SnapshotService => ({
  id: 'svc-1',
  name: 'storefront',
  kind: 'git',
  state: 'running',
  source: { kind: 'git' },
  replicas: 1,
  cpuCores: 1,
  memoryMb: 512,
  deployStrategy: 'rolling',
  autoRollback: true,
  storage: { mounted: false, limited: false },
  serverId: 'srv-1',
  usage: { peakMemMb: 200, avgMemMb: 150, peakCpuPct: 20, avgCpuPct: 10, samples: 9000 },
  deployments7d: { total: 4, failed: 0 },
  domains: { count: 1, allHttps: true },
  hasBackup: true,
  ...overrides,
});

const snapshot = (services: SnapshotService[], servers: AdvisorSnapshot['servers'] = []): AdvisorSnapshot => ({
  generatedAt: '2026-11-17T12:00:00Z',
  windowDays: 7,
  servers,
  services,
  backupTargets: 1,
});

const ids = (findings: { fingerprint: string }[]) => findings.map((f) => f.fingerprint);

describe('RuleEngine memory', () => {
  it('suggests more memory, with the exact numbers, when a service peaks near its limit', () => {
    const [finding] = RuleEngine.evaluate(snapshot([service({ usage: { peakMemMb: 480, avgMemMb: 400, peakCpuPct: 10, avgCpuPct: 5, samples: 9000 } })]));
    expect(finding.fingerprint).toBe('memory-raise:svc-1');
    expect(finding.severity).toBe('warning');
    expect(finding.action).toEqual({ type: 'set-resources', serviceId: 'svc-1', memoryMb: 768 });
    expect(finding.detail).toContain('480 MB of its 512 MB');
    expect(finding.detail).toContain('768 MB');
    expect(finding.evidence[0]).toBe('Peak memory 480 MB of 512 MB (94%)');
  });

  it('turns critical at the very limit and picks a tier with headroom', () => {
    const [finding] = RuleEngine.evaluate(snapshot([service({ memoryMb: 1024, usage: { peakMemMb: 1020, avgMemMb: 900, peakCpuPct: 1, avgCpuPct: 1, samples: 9000 } })]));
    expect(finding.severity).toBe('critical');
    expect(finding.action).toMatchObject({ memoryMb: 1536 });
  });

  it('leaves a healthy service alone', () => {
    expect(RuleEngine.evaluate(snapshot([service()]))).toEqual([]);
  });

  it('does not judge a service from a handful of samples', () => {
    expect(RuleEngine.evaluate(snapshot([service({ usage: { peakMemMb: 510, avgMemMb: 500, peakCpuPct: 1, avgCpuPct: 1, samples: 10 } })]))).toEqual([]);
  });

  it('suggests lowering an oversized limit, but only with several days of data', () => {
    const oversized = service({ memoryMb: 4096, usage: { peakMemMb: 500, avgMemMb: 300, peakCpuPct: 5, avgCpuPct: 3, samples: 9000 } });
    const [finding] = RuleEngine.evaluate(snapshot([oversized]));
    expect(finding.fingerprint).toBe('memory-lower:svc-1');
    expect(finding.severity).toBe('info');
    expect(finding.action).toMatchObject({ memoryMb: 1024 });
    expect(RuleEngine.evaluate(snapshot([{ ...oversized, usage: { ...oversized.usage!, samples: 500 } }]))).toEqual([]);
  });

  it('never suggests lowering while deploys are failing, or below 256 MB', () => {
    const failing = service({ memoryMb: 4096, deployments7d: { total: 2, failed: 1 }, usage: { peakMemMb: 100, avgMemMb: 90, peakCpuPct: 1, avgCpuPct: 1, samples: 9000 } });
    expect(ids(RuleEngine.evaluate(snapshot([failing])))).not.toContain('memory-lower:svc-1');
    const tiny = service({ memoryMb: 2048, usage: { peakMemMb: 20, avgMemMb: 10, peakCpuPct: 1, avgCpuPct: 1, samples: 9000 } });
    const action = RuleEngine.evaluate(snapshot([tiny]))[0].action as { memoryMb: number };
    expect(action.memoryMb).toBeGreaterThanOrEqual(256);
  });

  it('skips stopped services', () => {
    expect(RuleEngine.evaluate(snapshot([service({ state: 'stopped', usage: { peakMemMb: 510, avgMemMb: 500, peakCpuPct: 1, avgCpuPct: 1, samples: 9000 } })]))).toEqual([]);
  });

  it('rounds up to the next tier', () => {
    expect(RuleEngine.nextMemoryTier(300)).toBe(512);
    expect(RuleEngine.nextMemoryTier(1024)).toBe(1024);
    expect(RuleEngine.nextMemoryTier(1025)).toBe(1536);
    expect(RuleEngine.nextMemoryTier(10_000_000)).toBe(32768);
  });
});

describe('RuleEngine reliability and safety', () => {
  it('flags a crashed service as critical, first', () => {
    const findings = RuleEngine.evaluate(snapshot([service({ state: 'crashed', autoRollback: false })]));
    expect(findings[0]).toMatchObject({ fingerprint: 'down:svc-1', severity: 'critical' });
  });

  it('flags repeated failed deploys', () => {
    expect(ids(RuleEngine.evaluate(snapshot([service({ deployments7d: { total: 4, failed: 3 } })])))).toContain('deploys-failing:svc-1');
    expect(ids(RuleEngine.evaluate(snapshot([service({ deployments7d: { total: 2, failed: 2 } })])))).not.toContain('deploys-failing:svc-1');
  });

  it('flags a volume with no limit and offers no action it cannot choose for you', () => {
    const [finding] = RuleEngine.evaluate(snapshot([service({ storage: { mounted: true, sizeGb: 5, limited: false } })]));
    expect(finding.fingerprint).toBe('volume-unlimited:svc-1');
    expect(finding.action).toBeUndefined();
  });

  it('offers to turn on automatic rollback for repositories only', () => {
    const [finding] = RuleEngine.evaluate(snapshot([service({ autoRollback: false })]));
    expect(finding.action).toEqual({ type: 'enable-auto-rollback', serviceId: 'svc-1' });
    expect(RuleEngine.evaluate(snapshot([service({ autoRollback: false, source: { kind: 'image' } })]))).toEqual([]);
  });

  it('warns about databases that were never backed up', () => {
    const finding = RuleEngine.evaluate(snapshot([service({ kind: 'database', hasBackup: false, source: { kind: 'image' } })]))[0];
    expect(finding.fingerprint).toBe('no-backup:svc-1');
    expect(RuleEngine.evaluate(snapshot([service({ kind: 'database', hasBackup: true, source: { kind: 'image' } })]))).toEqual([]);
  });

  it('warns about domains served without HTTPS', () => {
    expect(ids(RuleEngine.evaluate(snapshot([service({ domains: { count: 2, allHttps: false } })])))).toContain('plain-http:svc-1');
    expect(ids(RuleEngine.evaluate(snapshot([service({ domains: { count: 0, allHttps: true } })])))).toEqual([]);
  });

  it('flags sustained CPU without inventing an action', () => {
    const [finding] = RuleEngine.evaluate(snapshot([service({ usage: { peakMemMb: 100, avgMemMb: 90, peakCpuPct: 99, avgCpuPct: 88, samples: 9000 } })]));
    expect(finding.fingerprint).toBe('cpu-sustained:svc-1');
    expect(finding.action).toBeUndefined();
  });
});

describe('RuleEngine servers', () => {
  const server = (storage: { budgetGb: number | null; allocatedGb: number }) => ({ id: 'srv-1', name: 'edge-1', cpuCores: 4, memoryMb: 8192, diskGb: 100, status: 'online', storage });

  it('notices a server with no storage budget', () => {
    expect(ids(RuleEngine.evaluate(snapshot([], [server({ budgetGb: null, allocatedGb: 0 })])))).toEqual(['no-budget:srv-1']);
  });

  it('warns when the budget is nearly fully allocated', () => {
    const [finding] = RuleEngine.evaluate(snapshot([], [server({ budgetGb: 25, allocatedGb: 20 })]));
    expect(finding.fingerprint).toBe('budget-full:srv-1');
    expect(finding.evidence[0]).toBe('20 of 21 GB allocated (95%)');
    expect(RuleEngine.evaluate(snapshot([], [server({ budgetGb: 25, allocatedGb: 10 })]))).toEqual([]);
  });
});

describe('RuleEngine output', () => {
  it('orders by severity and caps the list', () => {
    const many = Array.from({ length: 20 }, (_, i) => service({ id: `s${i}`, name: `n${i}`, autoRollback: false }));
    many.push(service({ id: 'crash', name: 'crash', state: 'crashed' }));
    const findings = RuleEngine.evaluate(snapshot(many));
    expect(findings).toHaveLength(12);
    expect(findings[0].fingerprint).toBe('down:crash');
  });

  it('gives every finding a stable fingerprint, so reruns do not duplicate', () => {
    const data = snapshot([service({ autoRollback: false, usage: { peakMemMb: 500, avgMemMb: 400, peakCpuPct: 1, avgCpuPct: 1, samples: 9000 } })]);
    expect(ids(RuleEngine.evaluate(data))).toEqual(ids(RuleEngine.evaluate(data)));
  });
});
