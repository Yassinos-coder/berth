import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BackupStatus } from '@prisma/client';
import { BackupRepository } from '../repositories/backup.repository';
import { BackupTargetsService } from './backup-targets.service';
import { BackupMapper } from '../mappers/backup.mapper';
import { ServiceRepository } from '../../services/repositories/service.repository';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { BackupCommandFactory } from '../../common/database/backup-command.factory';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import { CreateBackupDto } from '../dto/create-backup.dto';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { BackupDto } from '../interfaces';

function containerNameFor(serviceId: string): string {
  return `berth-${serviceId}`;
}

@Injectable()
export class BackupsService {
  constructor(
    private readonly repository: BackupRepository,
    private readonly services: ServiceRepository,
    private readonly backupTargets: BackupTargetsService,
    private readonly secretCipher: SecretCipher,
    private readonly registry: AgentRegistry,
  ) {}

  async list(orgId: string, serviceId: string): Promise<BackupDto[]> {
    await this.assertService(orgId, serviceId);
    const backups = await this.repository.listForService(orgId, serviceId);
    return backups.map(BackupMapper.toDto);
  }

  async create(
    user: AuthenticatedUser,
    serviceId: string,
    dto: CreateBackupDto,
  ): Promise<BackupDto> {
    const service = await this.assertService(user.orgId, serviceId);
    if (!BackupCommandFactory.supports(service.templateKind)) {
      throw new BadRequestException(
        'Backups are only supported for Postgres, MySQL, MariaDB, and Mongo services',
      );
    }

    const target = await this.backupTargets.resolve(
      user.orgId,
      dto.backupTargetId,
    );
    if (!target) throw new BadRequestException('Backup target not found');

    const env = this.decryptEnv(service.envVars);
    const dumpCommand = BackupCommandFactory.dumpCommand(
      service.templateKind!,
      env,
    );

    const backupId = randomUUID();
    const objectKey = `${serviceId}/${backupId}.sql.gz`;
    const backup = await this.repository.create({
      id: backupId,
      orgId: user.orgId,
      serviceId,
      backupTargetId: dto.backupTargetId,
      objectKey,
    });

    const sent = this.registry.send(service.serverId, {
      type: 'RunBackup',
      serviceId,
      backupId,
      containerName: containerNameFor(serviceId),
      dumpCommand,
      target,
      objectKey,
    });
    if (!sent) {
      await this.repository.markFinished(backupId, {
        status: BackupStatus.failed,
        errorMessage: 'Server is offline',
      });
      throw new BadRequestException('Server is offline');
    }

    return BackupMapper.toDto(backup);
  }

  async restore(
    user: AuthenticatedUser,
    serviceId: string,
    backupId: string,
  ): Promise<void> {
    const service = await this.assertService(user.orgId, serviceId);
    const backup = await this.repository.findById(user.orgId, backupId);
    if (!backup || backup.serviceId !== serviceId) {
      throw new NotFoundException('Backup not found');
    }
    if (backup.status !== BackupStatus.success || !backup.objectKey) {
      throw new BadRequestException('Only successful backups can be restored');
    }
    if (!BackupCommandFactory.supports(service.templateKind)) {
      throw new BadRequestException('Unsupported service for restore');
    }

    const target = await this.backupTargets.resolve(
      user.orgId,
      backup.backupTargetId,
    );
    if (!target) throw new BadRequestException('Backup target not found');

    const env = this.decryptEnv(service.envVars);
    const restoreCommand = BackupCommandFactory.restoreCommand(
      service.templateKind!,
      env,
    );

    const sent = this.registry.send(service.serverId, {
      type: 'RunRestore',
      serviceId,
      containerName: containerNameFor(serviceId),
      restoreCommand,
      target,
      objectKey: backup.objectKey,
    });
    if (!sent) throw new BadRequestException('Server is offline');
  }

  private async assertService(orgId: string, serviceId: string) {
    const service = await this.services.findWithConnection(orgId, serviceId);
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }

  private decryptEnv(
    envVars: { key: string; value: string; isSecret: boolean }[],
  ): Record<string, string> {
    const result: Record<string, string> = {};
    for (const item of envVars) {
      result[item.key] = item.isSecret
        ? this.secretCipher.decrypt(item.value)
        : item.value;
    }
    return result;
  }
}
