import { Injectable } from '@nestjs/common';
import { Backup, BackupStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

const withTarget = {
  backupTarget: { select: { name: true } },
} satisfies Prisma.BackupInclude;

type BackupWithTarget = Backup & { backupTarget: { name: string } };

@Injectable()
export class BackupRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForService(orgId: string, serviceId: string): Promise<BackupWithTarget[]> {
    return this.prisma.backup.findMany({
      where: { orgId, serviceId },
      orderBy: { startedAt: 'desc' },
      include: withTarget,
    });
  }

  findById(orgId: string, id: string): Promise<BackupWithTarget | null> {
    return this.prisma.backup.findFirst({
      where: { id, orgId },
      include: withTarget,
    });
  }

  create(data: {
    id: string;
    orgId: string;
    serviceId: string;
    backupTargetId: string;
    objectKey: string;
  }): Promise<BackupWithTarget> {
    return this.prisma.backup.create({ data, include: withTarget });
  }

  markFinished(
    id: string,
    data: { status: BackupStatus; sizeBytes?: bigint; errorMessage?: string },
  ): Promise<Backup> {
    return this.prisma.backup.update({
      where: { id },
      data: { ...data, finishedAt: new Date() },
    });
  }
}
