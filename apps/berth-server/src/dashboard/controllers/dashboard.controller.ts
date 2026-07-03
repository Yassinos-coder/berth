import { Controller, Get } from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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
}
