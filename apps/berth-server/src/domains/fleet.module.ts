import { Module } from '@nestjs/common';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';
import { ServersModule } from '../servers/servers.module';
import { SystemModule } from '../system/system.module';
import { DashboardModule } from '../dashboard/dashboard.module';

@Module({
  imports: [AgentGatewayModule, ServersModule, SystemModule, DashboardModule],
  exports: [AgentGatewayModule, ServersModule, SystemModule, DashboardModule],
})
export class FleetModule {}
