import { Module } from '@nestjs/common';
import { BackupTargetsController } from './controllers/backup-targets.controller';
import { BackupsController } from './controllers/backups.controller';
import { BackupTargetsService } from './services/backup-targets.service';
import { BackupsService } from './services/backups.service';
import { BackupTargetRepository } from './repositories/backup-target.repository';
import { BackupRepository } from './repositories/backup.repository';
import { ServicesModule } from '../services/services.module';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';

@Module({
  imports: [ServicesModule, AgentGatewayModule],
  controllers: [BackupTargetsController, BackupsController],
  providers: [
    BackupTargetsService,
    BackupsService,
    BackupTargetRepository,
    BackupRepository,
  ],
})
export class BackupsModule {}
