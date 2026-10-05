import { forwardRef, Module } from '@nestjs/common';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';
import { PreviewsService } from './services/previews.service';

@Module({
  imports: [forwardRef(() => AgentGatewayModule)],
  providers: [PreviewsService],
  exports: [PreviewsService],
})
export class PreviewsModule {}
