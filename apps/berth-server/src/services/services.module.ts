import { Module } from '@nestjs/common';
import { ServicesController } from './controllers/services.controller';
import { ServicesService } from './services/services.service';
import { ConnectionService } from './services/connection.service';
import { ReplicaEngineService } from './services/replica-engine.service';
import { ReplicaAutoscalerService } from './services/replica-autoscaler.service';
import { ServiceRepository } from './repositories/service.repository';
import { ServersModule } from '../servers/servers.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { ActivityModule } from '../activity/activity.module';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';
import { RegistryCredentialsModule } from '../registry-credentials/registry-credentials.module';

@Module({
  imports: [
    ServersModule,
    DeploymentsModule,
    ActivityModule,
    AgentGatewayModule,
    RegistryCredentialsModule,
  ],
  controllers: [ServicesController],
  providers: [
    ServicesService,
    ConnectionService,
    ReplicaEngineService,
    ReplicaAutoscalerService,
    ServiceRepository,
  ],
  exports: [ServicesService, ServiceRepository, ReplicaEngineService],
})
export class ServicesModule {}
