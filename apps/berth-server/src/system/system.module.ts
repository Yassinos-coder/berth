import { Module } from '@nestjs/common';
import { SystemController } from './controllers/system.controller';
import { SystemService } from './services/system.service';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';

@Module({
  imports: [AgentGatewayModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
