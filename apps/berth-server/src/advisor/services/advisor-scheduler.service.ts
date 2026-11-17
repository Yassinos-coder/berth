import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ADVISOR_RUN_INTERVAL_MS } from '../constants/advisor.constants';
import { AdvisorRepository } from '../repositories/advisor.repository';
import { AdvisorAnalysisService } from './advisor-analysis.service';

const TICK_MS = 60 * 60 * 1000;

@Injectable()
export class AdvisorSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdvisorSchedulerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly repository: AdvisorRepository,
    private readonly analysis: AdvisorAnalysisService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(now = new Date()): Promise<void> {
    const enabled = await this.repository.listEnabledSettings().catch(() => []);
    for (const settings of enabled) {
      const due = !settings.lastRunAt || now.getTime() - settings.lastRunAt.getTime() >= ADVISOR_RUN_INTERVAL_MS;
      if (!due) continue;
      await this.analysis.run(settings.orgId, { manual: false }).catch((error: unknown) => {
        this.logger.warn(`scheduled advisor run failed for ${settings.orgId}: ${error instanceof Error ? error.message : 'unknown'}`);
      });
    }
  }
}
