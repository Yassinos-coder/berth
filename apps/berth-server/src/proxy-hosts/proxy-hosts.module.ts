import { Module } from '@nestjs/common';
import { ProxyHostsController } from './controllers/proxy-hosts.controller';
import { ProxyHostsService } from './services/proxy-hosts.service';
import { ProxyHostRepository } from './repositories/proxy-host.repository';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';

@Module({
  imports: [AgentGatewayModule],
  controllers: [ProxyHostsController],
  providers: [ProxyHostsService, ProxyHostRepository],
})
export class ProxyHostsModule {}
