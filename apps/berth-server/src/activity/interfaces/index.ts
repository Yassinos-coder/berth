import type { ActivityKind } from '@prisma/client';

export interface ActivityItemDto {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  actor: string;
  createdAt: string;
}

export interface RecordActivityInput {
  kind: ActivityKind;
  title: string;
  detail?: string;
  actor?: string;
}
