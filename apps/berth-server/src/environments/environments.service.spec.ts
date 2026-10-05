import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentsService } from './environments.service';

function build(options: { environment?: object | null; updated?: number; services?: number } = {}) {
  const prisma = {
    environment: {
      findFirst: vi.fn().mockResolvedValue(
        options.environment === undefined
          ? { id: 'e1', _count: { services: options.services ?? 0 } }
          : options.environment,
      ),
      updateMany: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    service: { updateMany: vi.fn().mockResolvedValue({ count: options.updated ?? 1 }) },
  };
  return { service: new EnvironmentsService(prisma as never), prisma };
}

describe('EnvironmentsService.assign', () => {
  it('moves a service into an environment of the same organization', async () => {
    const { service, prisma } = build();
    await service.assign('o1', 's1', 'e1');
    expect(prisma.environment.findFirst).toHaveBeenCalledWith({ where: { id: 'e1', orgId: 'o1' } });
    expect(prisma.service.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', orgId: 'o1' },
      data: { environmentId: 'e1' },
    });
  });

  it('removes a service from its environment when given null', async () => {
    const { service, prisma } = build();
    await service.assign('o1', 's1', null);
    expect(prisma.environment.findFirst).not.toHaveBeenCalled();
    expect(prisma.service.updateMany).toHaveBeenCalledWith({
      where: { id: 's1', orgId: 'o1' },
      data: { environmentId: null },
    });
  });

  it('rejects an environment from another organization', async () => {
    const { service, prisma } = build({ environment: null });
    await expect(service.assign('o1', 's1', 'foreign')).rejects.toThrow(NotFoundException);
    expect(prisma.service.updateMany).not.toHaveBeenCalled();
  });

  it('rejects an unknown service', async () => {
    const { service } = build({ updated: 0 });
    await expect(service.assign('o1', 'nope', 'e1')).rejects.toThrow(NotFoundException);
  });
});

describe('EnvironmentsService.create and remove', () => {
  it('slugifies the name and makes production exclusive', async () => {
    const { service, prisma } = build();
    await service.create('o1', { name: ' My Staging! ', isProduction: true });
    expect(prisma.environment.updateMany).toHaveBeenCalledWith({
      where: { orgId: 'o1', isProduction: true },
      data: { isProduction: false },
    });
    expect(prisma.environment.create.mock.calls[0][0].data).toMatchObject({ name: 'My Staging!', slug: 'my-staging' });
  });

  it('rejects a name with no usable characters', async () => {
    const { service } = build();
    await expect(service.create('o1', { name: '!!!' })).rejects.toThrow(BadRequestException);
  });

  it('refuses to delete an environment that still has services', async () => {
    const { service, prisma } = build({ services: 2 });
    await expect(service.remove('o1', 'e1')).rejects.toThrow(BadRequestException);
    expect(prisma.environment.delete).not.toHaveBeenCalled();
  });

  it('deletes an empty environment', async () => {
    const { service, prisma } = build({ services: 0 });
    await service.remove('o1', 'e1');
    expect(prisma.environment.delete).toHaveBeenCalledWith({ where: { id: 'e1' } });
  });
});
