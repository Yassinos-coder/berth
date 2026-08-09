import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { Role } from '@prisma/client';
import { DashboardService } from '../services/dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { DashboardStatsDto } from '../interfaces';
import type { ActivityItemDto } from '../../activity/interfaces';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  stats(@CurrentUser() user: AuthenticatedUser): Promise<DashboardStatsDto> {
    return this.dashboardService.stats(user.orgId);
  }

  @Get('activity')
  activity(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ActivityItemDto[]> {
    return this.dashboardService.activity(user.orgId);
  }

  @Roles(Role.owner, Role.admin)
  @Delete('activity')
  @HttpCode(204)
  clearActivity(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.dashboardService.clearActivity(user.orgId);
  }
}
