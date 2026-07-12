import { Module } from '@nestjs/common';
import { ServicesController } from './controllers/services.controller';
import { ServicesService } from './services/services.service';
import { ConnectionService } from './services/connection.service';
import { ServiceRepository } from './repositories/service.repository';
import { ServersModule } from '../servers/servers.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ActivityModule } from '../activity/activity.module';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';

@Module({
  imports: [ServersModule, DeploymentsModule, ActivityModule, AgentGatewayModule],
  controllers: [ServicesController],
  providers: [ServicesService, ConnectionService, ServiceRepository],
})
export class ServicesModule {}
