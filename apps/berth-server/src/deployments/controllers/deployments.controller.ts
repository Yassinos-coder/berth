import { Controller, Get, Param, Post, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DeploymentsService } from '../services/deployments.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { DeploymentDto } from '../interfaces';

@Controller('deployments')
export class DeploymentsController {
  constructor(private readonly deploymentsService: DeploymentsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('serviceId') serviceId?: string,
  ): Promise<DeploymentDto[]> {
    if (serviceId) {
      return this.deploymentsService.listForService(user.orgId, serviceId);
    }
    return this.deploymentsService.list(user.orgId);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post(':id/rollback')
  rollback(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<{ ok: boolean }> {
    return this.deploymentsService.rollback(user, id);
  }
}
