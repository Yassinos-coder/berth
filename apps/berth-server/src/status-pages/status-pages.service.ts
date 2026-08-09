import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateIncidentDto, CreateStatusPageDto } from './status-pages.controller';
@Injectable()
export class StatusPagesService {
  constructor(private readonly prisma: PrismaService) {}
  list(orgId: string) { return this.prisma.statusPage.findMany({ where: { orgId }, include: { incidents: { orderBy: { createdAt: 'desc' }, take: 20 } } }); }
  async create(orgId: string, dto: CreateStatusPageDto) {
    const slug = dto.slug.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/^-|-$/g, '');
    const count = await this.prisma.service.count({ where: { orgId, id: { in: dto.serviceIds } } });
    if (count !== dto.serviceIds.length) throw new NotFoundException('One or more services were not found');
    return this.prisma.statusPage.create({ data: { orgId, slug, title: dto.title, description: dto.description ?? '', serviceIds: dto.serviceIds } });
  }
  async publicPage(slug: string) {
    const page = await this.prisma.statusPage.findFirst({ where: { slug, published: true }, include: { incidents: { orderBy: { createdAt: 'desc' }, take: 20 } } });
    if (!page) throw new NotFoundException('Status page not found');
    const services = await this.prisma.service.findMany({ where: { orgId: page.orgId, id: { in: page.serviceIds } }, select: { id: true, name: true, state: true, lastDeployedAt: true } });
    return { title: page.title, description: page.description, overall: services.every((service) => service.state === 'running') ? 'operational' : 'degraded', services, incidents: page.incidents };
  }
  async incident(orgId: string, id: string, dto: CreateIncidentDto) { const page = await this.prisma.statusPage.findFirst({ where: { id, orgId } }); if (!page) throw new NotFoundException('Status page not found'); return this.prisma.statusIncident.create({ data: { statusPageId: id, title: dto.title, message: dto.message } }); }
  async resolve(orgId: string, id: string, incidentId: string) { const result = await this.prisma.statusIncident.updateMany({ where: { id: incidentId, statusPageId: id, statusPage: { orgId } }, data: { resolved: true, resolvedAt: new Date() } }); if (!result.count) throw new NotFoundException('Incident not found'); return { ok: true }; }
}
