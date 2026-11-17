import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityKind, AdvisorFindingStatus } from '@prisma/client';
import type { AdvisorFindingDto } from '@berth/protocol';
import { ActivityService } from '../../activity/activity.service';
import type { AuthenticatedUser } from '../../common/interfaces';
import { ServicesService } from '../../services/services/services.service';
import { AdvisorRepository } from '../repositories/advisor.repository';
import { FindingMapper } from '../mappers/finding.mapper';
import { UndoMapper } from '../mappers/undo.mapper';
import { FindingActionValidator } from '../validators/finding-action.validator';

@Injectable()
export class AdvisorApplyService {
  constructor(
    private readonly repository: AdvisorRepository,
    private readonly services: ServicesService,
    private readonly activity: ActivityService,
  ) {}

  async apply(user: AuthenticatedUser, id: string): Promise<AdvisorFindingDto> {
    const finding = await this.openFinding(user.orgId, id);
    const ids = await this.repository.serviceIds(user.orgId);
    const { action, error } = FindingActionValidator.validate(finding.action, {
      serviceExists: (serviceId) => ids.has(serviceId),
    });
    if (!action) throw new BadRequestException(error);

    const current = await this.repository.currentService(user.orgId, action.serviceId);
    if (!current) throw new NotFoundException('The service no longer exists.');

    const undo = UndoMapper.capture(action, current);
    await this.services.updateSettings(user, action.serviceId, UndoMapper.toUpdate(action));
    const saved = await this.repository.markResolved(id, AdvisorFindingStatus.applied, user.id, { ...undo });

    await this.activity.record(user.orgId, {
      kind: ActivityKind.system,
      title: `Advisor change applied to ${current.name}`,
      detail: FindingActionValidator.describe(action, current.name, {
        cpuCores: current.cpuCores,
        memoryMb: current.memoryMb,
        diskGb: current.diskGb ?? undefined,
      }),
      actor: user.id,
    });
    return this.present(user.orgId, saved);
  }

  async dismiss(user: AuthenticatedUser, id: string): Promise<AdvisorFindingDto> {
    await this.openFinding(user.orgId, id);
    const saved = await this.repository.markResolved(id, AdvisorFindingStatus.dismissed, user.id);
    return this.present(user.orgId, saved);
  }

  async undo(user: AuthenticatedUser, id: string): Promise<AdvisorFindingDto> {
    const finding = await this.repository.findFinding(user.orgId, id);
    if (!finding) throw new NotFoundException('Suggestion not found');
    const undo = UndoMapper.parse(finding.undo);
    if (finding.status !== AdvisorFindingStatus.applied || !undo) {
      throw new BadRequestException('This change can no longer be undone.');
    }
    const current = await this.repository.currentService(user.orgId, undo.serviceId);
    if (!current) throw new NotFoundException('The service no longer exists.');

    await this.services.updateSettings(user, undo.serviceId, UndoMapper.toRestore(undo));
    const saved = await this.repository.clearUndo(id, user.id);
    await this.activity.record(user.orgId, {
      kind: ActivityKind.system,
      title: `Advisor change reverted on ${current.name}`,
      actor: user.id,
    });
    return this.present(user.orgId, saved);
  }

  private async openFinding(orgId: string, id: string) {
    const finding = await this.repository.findFinding(orgId, id);
    if (!finding) throw new NotFoundException('Suggestion not found');
    if (finding.status !== AdvisorFindingStatus.open) {
      throw new BadRequestException('This suggestion was already handled.');
    }
    return finding;
  }

  private async present(orgId: string, finding: Parameters<typeof FindingMapper.toDto>[0]) {
    const ids = [finding.serviceId, ...this.actionServiceIds(finding.action)].filter((value): value is string => Boolean(value));
    const briefs = await this.repository.servicesBrief(orgId, ids);
    return FindingMapper.toDto(finding, new Map(briefs.map((brief) => [brief.id, brief])));
  }

  private actionServiceIds(action: unknown): string[] {
    const parsed = FindingActionValidator.parse(action);
    return parsed ? [parsed.serviceId] : [];
  }
}
