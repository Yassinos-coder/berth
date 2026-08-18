import { Injectable } from '@nestjs/common';
import { DashboardRepository } from '../repositories/dashboard.repository';
import { ActivityService } from '../../activity/activity.service';
import { TelemetryBuffer } from '../../agent-gateway/buffers/telemetry-buffer.service';
import type { DashboardStatsDto } from '../interfaces';
import type { ActivityItemDto } from '../../activity/interfaces';

@Injectable()
export class DashboardService {
  constructor(
    private readonly repository: DashboardRepository,
    private readonly activityService: ActivityService,
    private readonly telemetry: TelemetryBuffer,
  ) {}

  async stats(orgId: string): Promise<DashboardStatsDto> {
    const [counts, running] = await Promise.all([
      this.repository.counts(orgId),
      this.repository.runningServices(orgId),
    ]);

    let cpuSum = 0;
    let memPctSum = 0;
    let sampled = 0;
    for (const service of running) {
      const latest = this.telemetry.getMetrics(service.id).at(-1);
      if (!latest) continue;
      cpuSum += latest.cpuPct;
      memPctSum += service.memoryMb > 0 ? (latest.memMb / service.memoryMb) * 100 : 0;
      sampled += 1;
    }

    return {
      ...counts,
      avgCpuPct: sampled > 0 ? Math.round(cpuSum / sampled) : 0,
      avgMemPct: sampled > 0 ? Math.round(memPctSum / sampled) : 0,
    };
  }

  activity(orgId: string): Promise<ActivityItemDto[]> {
    return this.activityService.recent(orgId);
  }

  clearActivity(orgId: string): Promise<void> {
    return this.activityService.clear(orgId);
  }
}
