import { Module } from '@nestjs/common';
import { DeploymentsController } from './controllers/deployments.controller';
import { DeploymentsService } from './services/deployments.service';
import { DeploymentRepository } from './repositories/deployment.repository';
import { ActivityModule } from '../activity/activity.module';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';

@Module({
  imports: [ActivityModule, AgentGatewayModule],
  controllers: [DeploymentsController],
  providers: [DeploymentsService, DeploymentRepository],
  exports: [DeploymentRepository],
})
export class DeploymentsModule {}
