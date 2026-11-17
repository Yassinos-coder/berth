import { Injectable } from '@nestjs/common';
import { AdvisorFindingStatus } from '@prisma/client';
import type { AdvisorFindingDto, AdvisorSummaryDto } from '@berth/protocol';
import { AdvisorRepository } from '../repositories/advisor.repository';
import { FindingMapper } from '../mappers/finding.mapper';
import { FindingActionValidator } from '../validators/finding-action.validator';
import { AdvisorSettingsService } from './advisor-settings.service';

@Injectable()
export class AdvisorFindingsService {
  constructor(
    private readonly repository: AdvisorRepository,
    private readonly settings: AdvisorSettingsService,
  ) {}

  async list(orgId: string, view: 'open' | 'history'): Promise<AdvisorFindingDto[]> {
    const statuses: AdvisorFindingStatus[] =
      view === 'open' ? [AdvisorFindingStatus.open] : [AdvisorFindingStatus.applied, AdvisorFindingStatus.dismissed];
    const findings = await this.repository.listFindings(orgId, statuses);
    const ids = findings.flatMap((finding) => {
      const action = FindingActionValidator.parse(finding.action);
      return [finding.serviceId, action?.serviceId].filter((value): value is string => Boolean(value));
    });
    const briefs = await this.repository.servicesBrief(orgId, [...new Set(ids)]);
    const map = new Map(briefs.map((brief) => [brief.id, brief]));
    return findings.map((finding) => FindingMapper.toDto(finding, map));
  }

  async summary(orgId: string): Promise<AdvisorSummaryDto> {
    const settings = await this.settings.ensure(orgId);
    const counts = await this.repository.openCounts(orgId);
    return {
      enabled: settings.enabled,
      openCount: counts.open,
      criticalCount: counts.critical,
      spentUsd: Math.round(settings.spentUsd * 10_000) / 10_000,
      capUsd: settings.monthlyCapUsd,
      ...(settings.lastRunAt ? { lastRunAt: settings.lastRunAt.toISOString() } : {}),
    };
  }
}
