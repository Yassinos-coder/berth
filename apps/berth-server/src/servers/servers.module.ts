import { Module } from '@nestjs/common';
import { ServersController } from './controllers/servers.controller';
import { ServersService } from './services/servers.service';
import { ServerRepository } from './repositories/server.repository';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  controllers: [ServersController],
  providers: [ServersService, ServerRepository],
  exports: [ServerRepository],
})
export class ServersModule {}
