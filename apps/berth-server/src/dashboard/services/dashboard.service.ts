import { Injectable } from '@nestjs/common';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { ActivityService } from '../../activity/activity.service';
import type { DashboardStatsDto } from '../interfaces';
import type { ActivityItemDto } from '../../activity/interfaces';

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly activityService: ActivityService,
  ) {}

  async stats(orgId: string): Promise<DashboardStatsDto> {
    const counts = await this.repository.counts(orgId);
    return {
      ...counts,
      avgCpuPct: 0,
      avgMemPct: 0,
    };
  }

  activity(orgId: string): Promise<ActivityItemDto[]> {
    return this.activityService.recent(orgId);
  }
}
