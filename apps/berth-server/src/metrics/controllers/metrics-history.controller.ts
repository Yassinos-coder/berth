import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import { MetricsHistoryService } from '../services/metrics-history.service';
import type { MetricReading } from '../interfaces';

@Controller('services')
export class MetricsHistoryController {
  constructor(private readonly history: MetricsHistoryService) {}

  @Get(':id/metrics/history')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('range') range?: string,
  ): Promise<MetricReading[]> {
    return this.history.history(user.orgId, id, range);
  }
}
