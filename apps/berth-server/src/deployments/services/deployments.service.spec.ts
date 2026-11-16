import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DeploymentStatus, DeploymentTrigger } from '@prisma/client';
import { DeploymentsService } from './deployments.service';

const user = { id: 'user-1', orgId: 'org-1' } as never;

function build(deployment: Record<string, unknown> | null, pinned = true) {
  const repository = {
    findById: vi.fn().mockResolvedValue(deployment),
    pinServiceCommit: vi.fn().mockResolvedValue(pinned),
    create: vi.fn().mockResolvedValue({}),
  };
  const activity = { record: vi.fn().mockResolvedValue(undefined) };
  const registry = { reconcileForService: vi.fn().mockResolvedValue(undefined) };
  const service = new DeploymentsService(
    repository as never,
    activity as never,
    registry as never,
  );
  return { service, repository, registry };
}

const live = {
  id: 'dep-1',
  serviceId: 'svc-1',
  status: DeploymentStatus.live,
  commitSha: 'a'.repeat(40),
  branch: 'main',
};

describe('DeploymentsService rollback', () => {
  it('pins the service to the deployment commit and forces a rebuild', async () => {
    const { service, repository, registry } = build(live);

    await expect(service.rollback(user, 'dep-1')).resolves.toEqual({ ok: true });

    expect(repository.pinServiceCommit).toHaveBeenCalledWith('org-1', 'svc-1', 'a'.repeat(40));
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: DeploymentTrigger.rollback, commitSha: 'a'.repeat(40) }),
    );
    expect(registry.reconcileForService).toHaveBeenCalledWith('svc-1', true);
  });

  it('refuses a deployment that never went live', async () => {
    const { service, repository, registry } = build({ ...live, status: DeploymentStatus.failed });

    await expect(service.rollback(user, 'dep-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.pinServiceCommit).not.toHaveBeenCalled();
    expect(registry.reconcileForService).not.toHaveBeenCalled();
  });

  it('refuses a deployment without a commit instead of redeploying the branch head', async () => {
    const { service, registry } = build({ ...live, commitSha: null });

    await expect(service.rollback(user, 'dep-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(registry.reconcileForService).not.toHaveBeenCalled();
  });

  it('reports an unknown deployment', async () => {
    const { service } = build(null);

    await expect(service.rollback(user, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('does not reconcile when the service no longer exists', async () => {
    const { service, repository, registry } = build(live, false);

    await expect(service.rollback(user, 'dep-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
    expect(registry.reconcileForService).not.toHaveBeenCalled();
  });
});
