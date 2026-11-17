import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ServicesModule } from '../services/services.module';
import { AdvisorController } from './controllers/advisor.controller';
import { AdvisorRepository } from './repositories/advisor.repository';
import { AdvisorAnalysisService } from './services/advisor-analysis.service';
import { AdvisorApplyService } from './services/advisor-apply.service';
import { AdvisorFindingsService } from './services/advisor-findings.service';
import { AdvisorProviderClient } from './services/advisor-provider.client';
import { AdvisorSchedulerService } from './services/advisor-scheduler.service';
import { AdvisorSettingsService } from './services/advisor-settings.service';

@Module({
  imports: [ServicesModule, ActivityModule],
  controllers: [AdvisorController],
  providers: [
    AdvisorRepository,
    AdvisorProviderClient,
    AdvisorSettingsService,
    AdvisorAnalysisService,
    AdvisorApplyService,
    AdvisorFindingsService,
    AdvisorSchedulerService,
  ],
})
export class AdvisorModule {}
