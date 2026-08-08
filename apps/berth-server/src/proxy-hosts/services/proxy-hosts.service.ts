import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProxyHostRepository } from '../repositories/proxy-host.repository';
import { PrismaService } from '../../prisma/prisma.service';
import { ProxyHostMapper } from '../mappers/proxy-host.mapper';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import { CreateProxyHostDto } from '../dto/create-proxy-host.dto';
import { UpdateProxyHostDto } from '../dto/update-proxy-host.dto';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { ProxyHostDto } from '../interfaces';

@Injectable()
export class ProxyHostsService {
  constructor(
    private readonly repository: ProxyHostRepository,
    private readonly registry: AgentRegistry,
    private readonly prisma: PrismaService,
  ) {}

  async list(orgId: string): Promise<ProxyHostDto[]> {
    const hosts = await this.repository.listByOrg(orgId);
    return hosts.map(ProxyHostMapper.toDto);
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateProxyHostDto,
  ): Promise<ProxyHostDto> {
    const service = await this.repository.serviceForOrg(user.orgId, dto.serviceId);
    if (!service) throw new BadRequestException('Target service not found');

    const domain = dto.domain.trim().toLowerCase();
    await this.assertNotPanelDomain(domain);
    const host = await this.persist(() =>
      this.repository.create({
        orgId: user.orgId,
        serviceId: dto.serviceId,
        domain,
        targetPort: dto.targetPort,
        ssl: dto.ssl ?? true,
        forceHttps: dto.forceHttps ?? true,
      }),
    );
    await this.registry.reconcileServer(service.serverId);
    return ProxyHostMapper.toDto(host);
  }

  async update(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateProxyHostDto,
  ): Promise<ProxyHostDto> {
    const existing = await this.repository.findById(user.orgId, id);
    if (!existing) throw new NotFoundException('Proxy host not found');

    const domain = dto.domain?.trim().toLowerCase();
    if (domain) await this.assertNotPanelDomain(domain);
    const updated = await this.persist(() =>
      this.repository.update(user.orgId, id, {
        domain,
        targetPort: dto.targetPort,
        ssl: dto.ssl,
        forceHttps: dto.forceHttps,
      }),
    );
    if (!updated) throw new NotFoundException('Proxy host not found');
    await this.registry.reconcileServer(existing.service.serverId);
    return ProxyHostMapper.toDto(updated);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(orgId, id);
    if (!existing) throw new NotFoundException('Proxy host not found');
    await this.repository.delete(orgId, id);
    await this.registry.reconcileServer(existing.service.serverId);
  }

  private async persist<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('That domain is already in use');
      }
      throw error;
    }
  }

  private async assertNotPanelDomain(domain: string): Promise<void> {
    const organization = await this.prisma.organization.findFirst({
      where: { panelDomain: domain },
      select: { id: true },
    });
    if (organization) {
      throw new BadRequestException(
        'That domain is already assigned to a Berth panel',
      );
    }
  }
}
