import { Module } from '@nestjs/common';
import { ProxyHostsController } from './controllers/proxy-hosts.controller';
import { ProxyHostsService } from './services/proxy-hosts.service';
import { DnsCheckService } from './services/dns-check.service';
import { ProxyHostRepository } from './repositories/proxy-host.repository';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';

@Module({
  imports: [AgentGatewayModule],
  controllers: [ProxyHostsController],
  providers: [ProxyHostsService, DnsCheckService, ProxyHostRepository],
})
export class ProxyHostsModule {}
