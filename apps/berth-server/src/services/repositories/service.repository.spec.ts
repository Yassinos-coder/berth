import { describe, expect, it, vi } from 'vitest';
import { ServiceKind, ServiceState, SourceKind } from '@prisma/client';
import { ServiceRepository } from './service.repository';

const input = {
  serviceId: 'svc-1',
  serverId: 'server-1',
  currentReplicas: 1,
  lastReplicaScaleAt: null,
  nextReplicas: 2,
  scaledAt: new Date('2026-11-16T20:00:00.000Z'),
};

function build(
  server: { cpuCores: number; memoryMb: number } | null,
  services: {
    id: string;
    serverId: string;
    replicas: number;
    cpuCores: number;
    memoryMb: number;
    state: string;
    lastReplicaScaleAt?: Date | null;
  }[],
) {
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    server: { findUnique: vi.fn().mockResolvedValue(server) },
    service: {
      findFirst: vi.fn(async ({ where }: { where: { id: string } }) =>
        services.find((service) => service.id === where.id) ?? null,
      ),
      findMany: vi.fn(
        async ({
          where,
        }: {
          where: {
            id?: { not: string };
            state?: { not: string };
          };
        }) =>
          services.filter(
            (service) =>
              service.id !== where.id?.not &&
              service.state !== where.state?.not,
          ),
      ),
      create: vi.fn().mockResolvedValue({
        id: 'svc-new',
        server: { name: 'server' },
        environment: null,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: vi.fn((action: (tx: typeof transaction) => Promise<unknown>) =>
      action(transaction),
    ),
  };
  return {
    repository: new ServiceRepository(prisma as never),
    transaction,
  };
}

describe('ServiceRepository autoscale claims', () => {
  it('blocks scale-up when existing allocations leave insufficient CPU capacity', async () => {
    const { repository, transaction } = build(
      { cpuCores: 2, memoryMb: 8192 },
      [
        { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
        { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
      ],
    );

    await expect(repository.claimReplicaScale(input)).resolves.toBe('capacity');
    expect(transaction.service.updateMany).not.toHaveBeenCalled();
  });

  it('blocks scale-up when existing allocations leave insufficient memory capacity', async () => {
    const { repository, transaction } = build(
      { cpuCores: 4, memoryMb: 2048 },
      [
        { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
        { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
      ],
    );

    await expect(repository.claimReplicaScale(input)).resolves.toBe('capacity');
    expect(transaction.service.updateMany).not.toHaveBeenCalled();
  });

  it('atomically reserves capacity before persisting a scale-up', async () => {
    const { repository, transaction } = build(
      { cpuCores: 4, memoryMb: 4096 },
      [
        { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
        { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
      ],
    );

    await expect(repository.claimReplicaScale(input)).resolves.toBe('claimed');
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.service.updateMany).toHaveBeenCalledOnce();
  });

  it('allows scale-down even if current allocations exceed host capacity', async () => {
    const { repository, transaction } = build(
      { cpuCores: 1, memoryMb: 1024 },
      [{ id: 'svc-1', serverId: 'server-1', replicas: 2, cpuCores: 1, memoryMb: 1024, state: 'running' }],
    );

    await expect(
      repository.claimReplicaScale({
        ...input,
        currentReplicas: 2,
        nextReplicas: 1,
      }),
    ).resolves.toBe('claimed');
    expect(transaction.service.updateMany).toHaveBeenCalledOnce();
  });

  it('guards service creation with the same server capacity lock', async () => {
    const { repository, transaction } = build(
      { cpuCores: 2, memoryMb: 2048 },
      [
        { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
        { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
      ],
    );

    await expect(
      repository.create({
        orgId: 'org-1',
        serverId: 'server-1',
        name: 'new-service',
        kind: ServiceKind.image,
        sourceKind: SourceKind.image,
        cpuCores: 1,
        memoryMb: 1024,
      }),
    ).resolves.toEqual({ status: 'capacity' });
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.service.create).not.toHaveBeenCalled();
  });

  it('blocks manual replica increases when they exceed capacity', async () => {
    const { repository, transaction } = build(
      { cpuCores: 2, memoryMb: 4096 },
      [
        { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
        { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
      ],
    );

    await expect(
      repository.updateReplicas('org-1', 'svc-1', 2),
    ).resolves.toEqual({ status: 'capacity' });
    expect(transaction.service.updateMany).not.toHaveBeenCalled();
  });

  it('blocks replica increases through service settings updates', async () => {
    const { repository, transaction } = build(
      { cpuCores: 2, memoryMb: 4096 },
      [
        { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
        { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
      ],
    );

    await expect(
      repository.updateBuildConfig('org-1', 'svc-1', { replicas: 2 }),
    ).resolves.toEqual({ status: 'capacity' });
    expect(transaction.service.updateMany).not.toHaveBeenCalled();
  });

  it('blocks starting a stopped service when its reservation exceeds capacity', async () => {
    const { repository, transaction } = build(
      { cpuCores: 1, memoryMb: 4096 },
      [
        { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'stopped' },
        { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
      ],
    );

    await expect(
      repository.updateStateWithCapacity(
        'org-1',
        'svc-1',
        ServiceState.starting,
      ),
    ).resolves.toEqual({ status: 'capacity' });
    expect(transaction.service.updateMany).not.toHaveBeenCalled();
  });

  it('reserves capacity before starting a stopped service', async () => {
    const { repository, transaction } = build(
      { cpuCores: 2, memoryMb: 4096 },
      [
        { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'stopped' },
        { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
      ],
    );

    await expect(
      repository.updateStateWithCapacity(
        'org-1',
        'svc-1',
        ServiceState.starting,
      ),
    ).resolves.toEqual({ status: 'saved', value: true });
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.service.updateMany).toHaveBeenCalledOnce();
  });
});

describe('ServiceRepository vertical scaling', () => {
  const twoServices = (second: string = 'running') => [
    { id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: 'running' },
    { id: 'svc-2', serverId: 'server-1', replicas: 1, cpuCores: 1, memoryMb: 1024, state: second },
  ];

  it('rejects a memory increase that exceeds the server', async () => {
    const { repository, transaction } = build({ cpuCores: 4, memoryMb: 2048 }, twoServices());

    await expect(
      repository.updateBuildConfig('org-1', 'svc-1', { memoryMb: 2048 }),
    ).resolves.toEqual({ status: 'capacity' });
    expect(transaction.service.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a CPU increase that exceeds the server', async () => {
    const { repository, transaction } = build({ cpuCores: 2, memoryMb: 8192 }, twoServices());

    await expect(
      repository.updateBuildConfig('org-1', 'svc-1', { cpuCores: 2 }),
    ).resolves.toEqual({ status: 'capacity' });
    expect(transaction.service.updateMany).not.toHaveBeenCalled();
  });

  it('saves an increase that fits, under the per-server lock', async () => {
    const { repository, transaction } = build({ cpuCores: 4, memoryMb: 4096 }, twoServices());

    const result = await repository.updateBuildConfig('org-1', 'svc-1', {
      cpuCores: 2,
      memoryMb: 2048,
    });

    expect(result.status).toBe('saved');
    expect(transaction.$queryRaw).toHaveBeenCalledOnce();
    expect(transaction.service.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cpuCores: 2,
          memoryMb: 2048,
          lastReplicaScaleAt: expect.any(Date),
        }),
      }),
    );
  });

  it('always allows lowering limits, even on an over-allocated server', async () => {
    const { repository } = build({ cpuCores: 1, memoryMb: 1024 }, twoServices());

    await expect(
      repository.updateBuildConfig('org-1', 'svc-1', { cpuCores: 0.5, memoryMb: 512 }),
    ).resolves.toMatchObject({ status: 'saved' });
  });

  it('does not reserve capacity for a stopped service', async () => {
    const { repository } = build(
      { cpuCores: 1, memoryMb: 1024 },
      [{ id: 'svc-1', serverId: 'server-1', replicas: 1, cpuCores: 0.5, memoryMb: 512, state: 'stopped' }],
    );

    await expect(
      repository.updateBuildConfig('org-1', 'svc-1', { memoryMb: 4096 }),
    ).resolves.toMatchObject({ status: 'saved' });
  });

  it('reports a missing service without writing', async () => {
    const { repository, transaction } = build({ cpuCores: 4, memoryMb: 4096 }, twoServices());

    await expect(
      repository.updateBuildConfig('org-1', 'svc-missing', { memoryMb: 2048 }),
    ).resolves.toEqual({ status: 'not-found' });
    expect(transaction.service.updateMany).not.toHaveBeenCalled();
  });

  it('does not touch capacity when only non-resource settings change', async () => {
    const { repository, transaction } = build({ cpuCores: 1, memoryMb: 1024 }, twoServices());

    await repository.updateBuildConfig('org-1', 'svc-1', { alertsMuted: true });

    expect(transaction.$queryRaw).not.toHaveBeenCalled();
  });
});
