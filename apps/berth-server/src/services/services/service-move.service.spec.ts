import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ServiceMoveService } from './service-move.service';

const USER = { id: 'u1', orgId: 'o1', role: 'admin' } as never;

function build(overrides: { service?: Record<string, unknown> | null; target?: Record<string, unknown> | null; moved?: unknown } = {}) {
  const service = overrides.service === undefined
    ? { id: 's1', name: 'api', serverId: 'srvA', sourceKind: 'image', volumePath: null, previewOfId: null, diskGb: null, server: { name: 'alpha' } }
    : overrides.service;
  const target = overrides.target === undefined ? { id: 'srvB', status: 'online', name: 'beta' } : overrides.target;
  const repository = {
    findById: vi.fn().mockResolvedValue(service),
    moveToServer: vi.fn().mockResolvedValue(
      overrides.moved ?? {
        status: 'saved',
        value: { id: 's1', name: 'api', server: { name: 'beta', ip: '1.2.3.4' }, envVars: [] },
      },
    ),
  };
  const servers = { findById: vi.fn().mockResolvedValue(target) };
  const deployments = { create: vi.fn().mockResolvedValue({}) };
  const storageQuota = { explainShortfall: vi.fn().mockResolvedValue('Not enough storage') };
  const activity = { record: vi.fn().mockResolvedValue(undefined) };
  const registry = { reconcileServer: vi.fn().mockResolvedValue(undefined) };
  const sut = new ServiceMoveService(
    repository as never, servers as never, deployments as never, storageQuota as never, activity as never, registry as never,
  );
  return { sut, repository, deployments, activity, registry };
}

describe('ServiceMoveService', () => {
  it('moves a service and reconciles both servers so the old copy is removed', async () => {
    const { sut, repository, registry, activity } = build();
    vi.spyOn(await import('../mappers/service.mapper'), 'ServiceMapper', 'get').mockReturnValue({ toDto: (value: unknown) => value } as never);
    await sut.move(USER, 's1', { serverId: 'srvB' });
    expect(repository.moveToServer).toHaveBeenCalledWith('o1', 's1', 'srvB');
    expect(registry.reconcileServer).toHaveBeenCalledWith('srvA');
    expect(registry.reconcileServer).toHaveBeenCalledWith('srvB');
    expect(activity.record.mock.calls[0][1].title).toBe('api moved to beta');
  });

  it('queues a build on the new server for a git service', async () => {
    const { sut, deployments } = build({
      service: { id: 's1', name: 'api', serverId: 'srvA', sourceKind: 'git', volumePath: null, previewOfId: null, diskGb: null, server: { name: 'alpha' } },
    });
    vi.spyOn(await import('../mappers/service.mapper'), 'ServiceMapper', 'get').mockReturnValue({ toDto: (value: unknown) => value } as never);
    await sut.move(USER, 's1', { serverId: 'srvB' });
    expect(deployments.create).toHaveBeenCalledTimes(1);
  });

  it('changes nothing when the move is refused', async () => {
    const { sut, repository, registry } = build({ target: { id: 'srvB', status: 'offline', name: 'beta' } });
    await expect(sut.move(USER, 's1', { serverId: 'srvB' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.moveToServer).not.toHaveBeenCalled();
    expect(registry.reconcileServer).not.toHaveBeenCalled();
  });

  it('requires confirmation before moving a service that has files', async () => {
    const stateful = { id: 's1', name: 'db', serverId: 'srvA', sourceKind: 'image', volumePath: '/data', previewOfId: null, diskGb: 5, server: { name: 'alpha' } };
    const { sut, repository } = build({ service: stateful });
    await expect(sut.move(USER, 's1', { serverId: 'srvB' })).rejects.toThrow(/do not move/);
    expect(repository.moveToServer).not.toHaveBeenCalled();
  });

  it('explains when the target is full', async () => {
    const { sut, registry } = build({ moved: { status: 'capacity' } });
    await expect(sut.move(USER, 's1', { serverId: 'srvB' })).rejects.toThrow(/CPU or memory/);
    expect(registry.reconcileServer).not.toHaveBeenCalled();
  });

  it('reports a missing service', async () => {
    const { sut } = build({ service: null });
    await expect(sut.move(USER, 'nope', { serverId: 'srvB' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
