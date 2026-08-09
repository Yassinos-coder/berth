import { Injectable, NotFoundException } from '@nestjs/common';
import { BackupTargetRepository } from '../repositories/backup-target.repository';
import { BackupTargetMapper } from '../mappers/backup-target.mapper';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { CreateBackupTargetDto } from '../dto/create-backup-target.dto';
import type { BackupTargetDto } from '../interfaces';

export interface ResolvedBackupTarget {
  endpoint: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

@Injectable()
export class BackupTargetsService {
  constructor(
    private readonly repository: BackupTargetRepository,
    private readonly secretCipher: SecretCipher,
  ) {}

  async list(orgId: string): Promise<BackupTargetDto[]> {
    const targets = await this.repository.listByOrg(orgId);
    return targets.map(BackupTargetMapper.toDto);
  }

  async create(
    orgId: string,
    dto: CreateBackupTargetDto,
  ): Promise<BackupTargetDto> {
    const target = await this.repository.create({
      orgId,
      name: dto.name,
      endpoint: dto.endpoint.trim(),
      bucket: dto.bucket.trim(),
      region: dto.region?.trim() ?? '',
      accessKeyId: dto.accessKeyId,
      secretAccessKeyEncrypted: this.secretCipher.encrypt(dto.secretAccessKey),
    });
    return BackupTargetMapper.toDto(target);
  }

  async remove(orgId: string, id: string): Promise<void> {
    const deleted = await this.repository.delete(orgId, id);
    if (!deleted) throw new NotFoundException('Backup target not found');
  }

  async resolve(
    orgId: string,
    id: string,
  ): Promise<ResolvedBackupTarget | null> {
    const target = await this.repository.findById(orgId, id);
    if (!target) return null;
    return {
      endpoint: target.endpoint,
      bucket: target.bucket,
      region: target.region || undefined,
      accessKeyId: target.accessKeyId,
      secretAccessKey: this.secretCipher.decrypt(target.secretAccessKeyEncrypted),
    };
  }
}
