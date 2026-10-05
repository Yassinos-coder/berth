import { describe, expect, it, vi } from 'vitest';
import { DeploymentStatus } from '@prisma/client';
import { AgentMessageHandler } from './agent-message.handler';

function build(options: { service?: object | null; deployment?: object | null } = {}) {
  const prisma = {
    service: {
      findFirst: vi.fn().mockResolvedValue(
        options.service === undefined ? { orgId: 'org1', name: 'web' } : options.service,
      ),
    },
    deployment: {
      findFirst: vi.fn().mockResolvedValue(
        options.deployment === undefined
          ? { id: 'dep1', createdAt: new Date(Date.now() - 12_000) }
          : options.deployment,
      ),
      update: vi.fn().mockResolvedValue({}),
    },
  };
  const notifications = { notify: vi.fn().mockResolvedValue(undefined) };
  const handler = new AgentMessageHandler(
    prisma as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    {} as never,
    {} as never,
  );
  return { handler, prisma, notifications };
}

describe('AgentMessageHandler ReconcileResult', () => {
  it('settles an applied service as live', async () => {
    const { handler, prisma, notifications } = build();
    await handler.handle('srv', { type: 'ReconcileResult', applied: ['svc1'], failed: [] });
    expect(prisma.deployment.update).toHaveBeenCalledWith({
      where: { id: 'dep1' },
      data: expect.objectContaining({ status: DeploymentStatus.live }),
    });
    expect(notifications.notify).toHaveBeenCalledWith(
      'org1',
      expect.objectContaining({ type: 'deployment.succeeded', severity: 'info' }),
    );
  });

  it('settles a failed service as failed and forwards the reason', async () => {
    const { handler, prisma, notifications } = build();
    await handler.handle('srv', {
      type: 'ReconcileResult',
      applied: [],
      failed: [{ serviceId: 'svc1', reason: 'build exploded' }],
    });
    expect(prisma.deployment.update).toHaveBeenCalledWith({
      where: { id: 'dep1' },
      data: expect.objectContaining({ status: DeploymentStatus.failed }),
    });
    const [, payload] = notifications.notify.mock.calls[0];
    expect(payload.type).toBe('deployment.failed');
    expect(payload.detail).toContain('build exploded');
  });

  it('does nothing when no deployment is pending (no-op reconcile)', async () => {
    const { handler, prisma, notifications } = build({ deployment: null });
    await handler.handle('srv', { type: 'ReconcileResult', applied: ['svc1'], failed: [] });
    expect(prisma.deployment.update).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('ignores services that belong to another server', async () => {
    const { handler, prisma } = build({ service: null });
    await handler.handle('srv', { type: 'ReconcileResult', applied: ['svc1'], failed: [] });
    expect(prisma.deployment.update).not.toHaveBeenCalled();
  });

  it('only looks at deployments that are still in flight', async () => {
    const { handler, prisma } = build();
    await handler.handle('srv', { type: 'ReconcileResult', applied: ['svc1'], failed: [] });
    const where = prisma.deployment.findFirst.mock.calls[0][0].where;
    expect(where.status.in).toEqual([
      DeploymentStatus.queued,
      DeploymentStatus.building,
      DeploymentStatus.deploying,
    ]);
  });
});
