import { describe, expect, it } from 'vitest';
import { ServerCapacity } from './serverCapacity';
import type { Server } from '@/interfaces';

const server = {
  id: 'srv',
  name: 'edge-1',
  cpuCores: 4,
  memoryMb: 8192,
  storage: { budgetGb: 25, reservedGb: 4, allocatedGb: 6, allocatableGb: 21, freeGb: 15 },
} as unknown as Server;

const service = (overrides: Record<string, unknown>) =>
  ({ serverId: 'srv', state: 'running', replicas: 1, resources: { cpuCores: 1, memoryMb: 1024 }, ...overrides }) as never;

describe('ServerCapacity', () => {
  it('reports what is used now and after the new service', () => {
    const report = ServerCapacity.compute(server, [service({}), service({ replicas: 2 })], { cpuCores: 1, memoryMb: 512, storageGb: 5 })!;
    expect(report.cpu).toMatchObject({ used: 3, total: 4, after: 4 });
    expect(report.memory).toMatchObject({ used: 3072, after: 3584 });
    expect(report.storage).toMatchObject({ allocatedGb: 6, afterGb: 11, allocatableGb: 21 });
    expect(report.problems).toEqual([]);
  });

  it('ignores stopped services and services on other servers', () => {
    const report = ServerCapacity.compute(server, [service({ state: 'stopped' }), service({ serverId: 'other' })], { cpuCores: 1, memoryMb: 512, storageGb: 0 })!;
    expect(report.cpu.used).toBe(0);
  });

  it('explains each resource that does not fit', () => {
    const report = ServerCapacity.compute(server, [service({ resources: { cpuCores: 3.5, memoryMb: 8000 } })], { cpuCores: 1, memoryMb: 1024, storageGb: 16 })!;
    expect(report.problems).toHaveLength(3);
    expect(report.problems[0]).toContain('0.5 vCPU unallocated');
    expect(report.problems[1]).toContain('192 MB of memory unallocated');
    expect(report.problems[2]).toContain('Only 15 GB');
  });

  it('accepts storage that exactly fits', () => {
    expect(ServerCapacity.compute(server, [], { cpuCores: 1, memoryMb: 512, storageGb: 15 })!.problems).toEqual([]);
  });

  it('does not limit storage on a server with no budget', () => {
    const unmanaged = { ...server, storage: { budgetGb: null, allocatedGb: 0, reservedGb: 0, allocatableGb: null, freeGb: null } } as unknown as Server;
    expect(ServerCapacity.compute(unmanaged, [], { cpuCores: 1, memoryMb: 512, storageGb: 5000 })!.problems).toEqual([]);
  });

  it('copes with a server that has no storage info yet', () => {
    const legacy = { ...server, storage: undefined } as unknown as Server;
    expect(ServerCapacity.compute(legacy, [], { cpuCores: 1, memoryMb: 512, storageGb: 5 })!.storage.budgetGb).toBeNull();
  });

  it('returns nothing until a server is chosen', () => {
    expect(ServerCapacity.compute(undefined, [], { cpuCores: 1, memoryMb: 1, storageGb: 1 })).toBeNull();
  });
});
