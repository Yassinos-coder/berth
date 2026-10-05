import { describe, expect, it, vi } from 'vitest';
import { PreviewsService } from './previews.service';
import type { PullRequestEvent } from '../interfaces';

const parent = {
  id: 'p1',
  orgId: 'o1',
  serverId: 's1',
  name: 'web',
  kind: 'git',
  sourceKind: 'git',
  repo: 'acme/web',
  branch: 'main',
  command: [],
  cpuCores: 1,
  memoryMb: 512,
  previewsEnabled: true,
  envVars: [{ key: 'A', value: 'enc', isSecret: true }],
  proxyHosts: [
    { path: '/', domain: 'app.example.com', targetPort: 3000, ssl: true, forceHttps: true },
    { path: '/api', domain: 'app.example.com', targetPort: 3000, ssl: true, forceHttps: true },
  ],
};

const event = (action: PullRequestEvent['action']): PullRequestEvent => ({
  action,
  number: 5,
  repo: 'acme/web',
  headRef: 'feat',
  headSha: 'sha1',
  baseRef: 'main',
  title: 'T',
  author: 'dev',
});

function build(existing: object | null = null, parents: object[] = [parent], previewEnvironment: object | null = null) {
  const prisma = {
    service: {
      findMany: vi.fn().mockResolvedValue(parents),
      findFirst: vi.fn().mockResolvedValue(existing),
      create: vi.fn().mockResolvedValue({ id: 'prev1', serverId: 's1' }),
      update: vi.fn().mockResolvedValue({ id: 'prev1', serverId: 's1' }),
      delete: vi.fn().mockResolvedValue({}),
    },
    environment: { findFirst: vi.fn().mockResolvedValue(previewEnvironment) },
    proxyHost: { create: vi.fn().mockResolvedValue({}) },
    deployment: { create: vi.fn().mockResolvedValue({}) },
  };
  const agents = {
    reconcileForService: vi.fn().mockResolvedValue(undefined),
    reconcileServer: vi.fn().mockResolvedValue(undefined),
    removeService: vi.fn(),
  };
  const telemetry = { clear: vi.fn() };
  const service = new PreviewsService(prisma as never, agents as never, telemetry as never);
  return { service, prisma, agents, telemetry };
}

describe('PreviewsService', () => {
  it('only considers git parents with previews enabled for the base branch', async () => {
    const { service, prisma } = build();
    await service.handle('o1', event('opened'));
    expect(prisma.service.findMany.mock.calls[0][0].where).toMatchObject({
      orgId: 'o1',
      repo: 'acme/web',
      branch: 'main',
      previewsEnabled: true,
      previewOfId: null,
    });
  });

  it('creates a preview, copies variables, and exposes only root proxy hosts', async () => {
    const { service, prisma, agents } = build();
    await service.handle('o1', event('opened'));
    const data = prisma.service.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ name: 'web-pr-5', branch: 'feat', previewOfId: 'p1', prNumber: 5 });
    expect(data.envVars.create).toEqual([{ key: 'A', value: 'enc', isSecret: true }]);
    expect(prisma.proxyHost.create).toHaveBeenCalledTimes(1);
    expect(prisma.proxyHost.create.mock.calls[0][0].data.domain).toBe('pr-5.app.example.com');
    expect(prisma.deployment.create).toHaveBeenCalledTimes(1);
    expect(agents.reconcileForService).toHaveBeenCalledWith('prev1', true);
  });

  it('redeploys the existing preview on synchronize instead of creating another', async () => {
    const { service, prisma, agents } = build({ id: 'prev1', serverId: 's1' });
    await service.handle('o1', event('synchronize'));
    expect(prisma.service.create).not.toHaveBeenCalled();
    expect(prisma.service.update.mock.calls[0][0].data).toMatchObject({ specHash: 'sha1', branch: 'feat' });
    expect(agents.reconcileForService).toHaveBeenCalledWith('prev1', true);
  });

  it('places previews in the organization preview environment when one exists', async () => {
    const { service, prisma } = build(null, [parent], { id: 'env-preview' });
    await service.handle('o1', event('opened'));
    expect(prisma.environment.findFirst.mock.calls[0][0].where).toEqual({ orgId: 'o1', preview: true });
    expect(prisma.service.create.mock.calls[0][0].data.environmentId).toBe('env-preview');
  });

  it('leaves the environment unset when there is no preview environment', async () => {
    const { service, prisma } = build();
    await service.handle('o1', event('opened'));
    expect(prisma.service.create.mock.calls[0][0].data.environmentId).toBeUndefined();
  });

  it('survives a duplicate preview domain', async () => {
    const { service, prisma } = build();
    prisma.proxyHost.create.mockRejectedValue(new Error('unique'));
    await expect(service.handle('o1', event('opened'))).resolves.toBe(1);
  });

  it('tears the preview down when the pull request closes', async () => {
    const { service, prisma, agents, telemetry } = build({ id: 'prev1', serverId: 's1' });
    await service.handle('o1', event('closed'));
    expect(prisma.service.delete).toHaveBeenCalledWith({ where: { id: 'prev1' } });
    expect(telemetry.clear).toHaveBeenCalledWith('prev1');
    expect(agents.removeService).toHaveBeenCalledWith('s1', 'prev1');
    expect(agents.reconcileServer).toHaveBeenCalledWith('s1');
    expect(prisma.service.create).not.toHaveBeenCalled();
  });

  it('ignores a close for a pull request that never had a preview', async () => {
    const { service, prisma } = build(null);
    await service.handle('o1', event('closed'));
    expect(prisma.service.delete).not.toHaveBeenCalled();
  });

  it('does nothing when no service opted in', async () => {
    const { service, prisma } = build(null, []);
    expect(await service.handle('o1', event('opened'))).toBe(0);
    expect(prisma.service.create).not.toHaveBeenCalled();
  });
});
