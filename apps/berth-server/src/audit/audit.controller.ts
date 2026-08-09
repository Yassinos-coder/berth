import { Controller, Get, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import { PrismaService } from '../prisma/prisma.service';
@Controller('audit-events')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}
  @Roles(Role.owner, Role.admin) @Get() list(@CurrentUser() user: AuthenticatedUser, @Query('cursor') cursor?: string) {
    return this.prisma.auditEvent.findMany({ where: { orgId: user.orgId }, orderBy: { createdAt: 'desc' }, take: 100, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
  }
}
