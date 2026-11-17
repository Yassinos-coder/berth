import { Module } from '@nestjs/common';
import { ServersController } from './controllers/servers.controller';
import { ServersService } from './services/servers.service';
import { ServerRepository } from './repositories/server.repository';
import { ActivityModule } from '../activity/activity.module';
import { PkiModule } from '../agent-gateway/pki/pki.module';

@Module({
  imports: [ActivityModule, PkiModule],
  controllers: [ServersController],
  providers: [ServersService, ServerRepository],
  exports: [ServerRepository],
})
export class ServersModule {}
