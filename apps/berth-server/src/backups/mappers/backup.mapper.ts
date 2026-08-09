import { Backup } from '@prisma/client';
import type { BackupDto } from '../interfaces';

type BackupWithTarget = Backup & { backupTarget: { name: string } };

export class BackupMapper {
  static toDto(backup: BackupWithTarget): BackupDto {
    return {
      id: backup.id,
      serviceId: backup.serviceId,
      backupTargetId: backup.backupTargetId,
      backupTargetName: backup.backupTarget.name,
      status: backup.status,
      sizeBytes: backup.sizeBytes ? Number(backup.sizeBytes) : undefined,
      errorMessage: backup.errorMessage ?? undefined,
      startedAt: backup.startedAt.toISOString(),
      finishedAt: backup.finishedAt?.toISOString(),
    };
  }
}
