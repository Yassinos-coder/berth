import { Injectable } from '@nestjs/common';
import { Activity, ActivityKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  listRecent(orgId: string, limit: number): Promise<Activity[]> {
    return this.prisma.activity.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  create(data: {
    orgId: string;
    kind: ActivityKind;
    title: string;
    detail: string;
    actor: string;
  }): Promise<Activity> {
    return this.prisma.activity.create({ data });
  }
}
