import type { AdvisorFinding } from '@prisma/client';
import type {
  AdvisorAction,
  AdvisorFindingDto,
  AdvisorFindingKind,
  AdvisorFindingSource,
  AdvisorFindingStatus,
  AdvisorSeverity,
  AdvisorSettingsDto,
} from '@berth/protocol';
import type { AdvisorSettings } from '@prisma/client';
import { FindingActionValidator } from '../validators/finding-action.validator';

export interface ServiceBrief {
  id: string;
  name: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number | null;
}

export class FindingMapper {
  static toDto(finding: AdvisorFinding, services: Map<string, ServiceBrief>): AdvisorFindingDto {
    const service = finding.serviceId ? services.get(finding.serviceId) : undefined;
    const action = FindingActionValidator.parse(finding.action) ?? undefined;
    const actionService = action ? services.get(action.serviceId) : undefined;
    const evidence = Array.isArray(finding.evidence)
      ? (finding.evidence as unknown[]).filter((item): item is string => typeof item === 'string')
      : [];

    return {
      id: finding.id,
      kind: finding.kind as AdvisorFindingKind,
      severity: finding.severity as AdvisorSeverity,
      source: finding.source as AdvisorFindingSource,
      status: finding.status as AdvisorFindingStatus,
      title: finding.title,
      detail: finding.detail,
      evidence,
      ...(finding.serviceId ? { serviceId: finding.serviceId } : {}),
      ...(service ? { serviceName: service.name } : {}),
      ...(action && finding.status === 'open' ? { action: action as AdvisorAction } : {}),
      ...(action && actionService && finding.status === 'open'
        ? {
            actionLabel: FindingActionValidator.describe(action, actionService.name, {
              cpuCores: actionService.cpuCores,
              memoryMb: actionService.memoryMb,
              diskGb: actionService.diskGb ?? undefined,
            }),
          }
        : {}),
      createdAt: finding.createdAt.toISOString(),
      ...(finding.resolvedAt ? { resolvedAt: finding.resolvedAt.toISOString() } : {}),
      canUndo: finding.status === 'applied' && finding.undo !== null,
    };
  }

  static settingsDto(settings: AdvisorSettings): AdvisorSettingsDto {
    return {
      enabled: settings.enabled,
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      hasKey: Boolean(settings.apiKeyEncrypted),
      monthlyCapUsd: settings.monthlyCapUsd,
      spentUsd: Math.round(settings.spentUsd * 10_000) / 10_000,
      priceInPerMTok: settings.priceInPerMTok,
      priceOutPerMTok: settings.priceOutPerMTok,
      periodStart: settings.periodStart.toISOString(),
      ...(settings.lastRunAt ? { lastRunAt: settings.lastRunAt.toISOString() } : {}),
      ...(settings.lastError ? { lastError: settings.lastError } : {}),
    };
  }
}
