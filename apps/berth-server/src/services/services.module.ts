import { Module } from '@nestjs/common';
import { ServicesController } from './controllers/services.controller';
import { ServicesService } from './services/services.service';
import { ServiceRepository } from './repositories/service.repository';
import { ServersModule } from '../servers/servers.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ServersModule, DeploymentsModule, ActivityModule],
  controllers: [ServicesController],
  providers: [ServicesService, ServiceRepository],
})
export class ServicesModule {}
