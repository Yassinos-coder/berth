import { BackupTarget } from '@prisma/client';
import type { BackupTargetDto } from '../interfaces';

export class BackupTargetMapper {
  static toDto(target: BackupTarget): BackupTargetDto {
    return {
      id: target.id,
      name: target.name,
      endpoint: target.endpoint,
      bucket: target.bucket,
      region: target.region,
      accessKeyId: target.accessKeyId,
      createdAt: target.createdAt.toISOString(),
    };
  }
}
