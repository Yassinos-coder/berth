import { Module } from '@nestjs/common';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({ imports: [AgentGatewayModule], controllers: [JobsController], providers: [JobsService] })
export class JobsModule {}
