import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateEnvironmentDto } from './environments.controller';

@Injectable()
export class EnvironmentsService {
  constructor(private readonly prisma: PrismaService) {}
  list(orgId: string) { return this.prisma.environment.findMany({ where: { orgId }, include: { _count: { select: { services: true } } }, orderBy: { createdAt: 'asc' } }); }
  async create(orgId: string, dto: CreateEnvironmentDto) {
    const slug = dto.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) throw new BadRequestException('Environment name is invalid');
    if (dto.isProduction) await this.prisma.environment.updateMany({ where: { orgId, isProduction: true }, data: { isProduction: false } });
    return this.prisma.environment.create({ data: { orgId, name: dto.name.trim(), slug, isProduction: dto.isProduction ?? false, preview: dto.preview ?? false } });
  }
  async assign(orgId: string, serviceId: string, environmentId: string) {
    const environment = await this.prisma.environment.findFirst({ where: { id: environmentId, orgId } });
    if (!environment) throw new NotFoundException('Environment not found');
    const result = await this.prisma.service.updateMany({ where: { id: serviceId, orgId }, data: { environmentId } });
    if (!result.count) throw new NotFoundException('Service not found');
    return { ok: true };
  }
  async remove(orgId: string, id: string) {
    const environment = await this.prisma.environment.findFirst({ where: { id, orgId }, include: { _count: { select: { services: true } } } });
    if (!environment) throw new NotFoundException('Environment not found');
    if (environment._count.services) throw new BadRequestException('Move services before deleting this environment');
    await this.prisma.environment.delete({ where: { id } });
  }
}
