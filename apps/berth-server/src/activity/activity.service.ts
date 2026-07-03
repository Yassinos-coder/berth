import { Injectable } from '@nestjs/common';
import { Activity } from '@prisma/client';
import { ActivityRepository } from './activity.repository';
import type { ActivityItemDto, RecordActivityInput } from './interfaces';

@Injectable()
export class ActivityService {
  constructor(private readonly repository: ActivityRepository) {}

  async recent(orgId: string): Promise<ActivityItemDto[]> {
    const items = await this.repository.listRecent(orgId, 20);
    return items.map(ActivityService.toDto);
  }

  async record(orgId: string, input: RecordActivityInput): Promise<void> {
    await this.repository.create({
      orgId,
      kind: input.kind,
      title: input.title,
      detail: input.detail ?? '',
      actor: input.actor ?? 'system',
    });
  }

  private static toDto(activity: Activity): ActivityItemDto {
    return {
      id: activity.id,
      kind: activity.kind,
      title: activity.title,
      detail: activity.detail,
      actor: activity.actor,
      createdAt: activity.createdAt.toISOString(),
    };
  }
}
