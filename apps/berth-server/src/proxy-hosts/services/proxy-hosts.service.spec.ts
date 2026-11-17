import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProxyHostsService } from './proxy-hosts.service';

const user = { id: 'user-1', orgId: 'org-1' } as never;

const existingHost = {
  id: 'host-1',
  orgId: 'org-1',
  serviceId: 'svc-a',
  domain: 'app.example.com',
  path: '/',
  targetPort: 80,
  ssl: true,
  forceHttps: true,
  createdAt: new Date('2026-11-01T00:00:00Z'),
  service: { name: 'web', serverId: 'srv-1' },
};

function build(options: { existing?: unknown; target?: unknown; updateError?: unknown } = {}) {
  const repository = {
    findById: vi.fn().mockResolvedValue(options.existing === undefined ? existingHost : options.existing),
    serviceForOrg: vi
      .fn()
      .mockResolvedValue(options.target === undefined ? { id: 'svc-b', serverId: 'srv-2', containerPort: 8080 } : options.target),
    update: options.updateError
      ? vi.fn().mockRejectedValue(options.updateError)
      : vi.fn().mockImplementation(async (_org: string, _id: string, data: Record<string, unknown>) => ({
          ...existingHost,
          ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)),
          service: { name: 'api', serverId: 'srv-2' },
        })),
  };
  const registry = { reconcileServer: vi.fn().mockResolvedValue(undefined) };
  const prisma = { organization: { findFirst: vi.fn().mockResolvedValue(null) } };
  const service = new ProxyHostsService(repository as never, registry as never, prisma as never);
  return { service, repository, registry, prisma };
}

describe('ProxyHostsService update', () => {
  it('changes the domain and reconciles the server', async () => {
    const { service, repository, registry } = build();

    const result = await service.update(user, 'host-1', { domain: ' New.Example.com ' });

    expect(repository.update).toHaveBeenCalledWith('org-1', 'host-1', expect.objectContaining({ domain: 'new.example.com' }));
    expect(registry.reconcileServer).toHaveBeenCalledWith('srv-1');
    expect(result.domain).toBe('new.example.com');
  });

  it('moves a host to another service and reconciles both servers', async () => {
    const { service, repository, registry } = build();

    await service.update(user, 'host-1', { serviceId: 'svc-b', targetPort: 8080 });

    expect(repository.update).toHaveBeenCalledWith('org-1', 'host-1', expect.objectContaining({ serviceId: 'svc-b', targetPort: 8080 }));
    expect(registry.reconcileServer).toHaveBeenCalledWith('srv-1');
    expect(registry.reconcileServer).toHaveBeenCalledWith('srv-2');
  });

  it('reconciles a shared server only once when moving within it', async () => {
    const { service, registry } = build({ target: { id: 'svc-b', serverId: 'srv-1', containerPort: 80 } });

    await service.update(user, 'host-1', { serviceId: 'svc-b' });

    expect(registry.reconcileServer).toHaveBeenCalledTimes(1);
  });

  it('rejects a target service outside the organization', async () => {
    const { service, repository, registry } = build({ target: null });

    await expect(service.update(user, 'host-1', { serviceId: 'svc-x' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
    expect(registry.reconcileServer).not.toHaveBeenCalled();
  });

  it('turns off force-HTTPS when HTTPS is turned off', async () => {
    const { service, repository } = build();

    await service.update(user, 'host-1', { ssl: false, forceHttps: true });

    expect(repository.update).toHaveBeenCalledWith('org-1', 'host-1', expect.objectContaining({ ssl: false, forceHttps: false }));
  });

  it('normalizes a trailing slash on the path', async () => {
    const { service, repository } = build();

    await service.update(user, 'host-1', { path: '/api/' });

    expect(repository.update).toHaveBeenCalledWith('org-1', 'host-1', expect.objectContaining({ path: '/api' }));
  });

  it('reports a domain and path that is already in use', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' });
    const { service, registry } = build({ updateError: conflict });

    await expect(service.update(user, 'host-1', { domain: 'taken.example.com' })).rejects.toThrow(/already in use/);
    expect(registry.reconcileServer).not.toHaveBeenCalled();
  });

  it('refuses a domain that belongs to the panel', async () => {
    const { service, prisma, repository } = build();
    prisma.organization.findFirst.mockResolvedValue({ id: 'org-1' });

    await expect(service.update(user, 'host-1', { domain: 'panel.example.com' })).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('reports an unknown host', async () => {
    const { service } = build({ existing: null });

    await expect(service.update(user, 'missing', { domain: 'a.example.com' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
