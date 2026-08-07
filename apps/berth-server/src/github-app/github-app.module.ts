import { forwardRef, Module } from '@nestjs/common';
import { GithubAppController } from './github-app.controller';
import { GithubWebhookController } from './github-webhook.controller';
import { GithubAppService } from './github-app.service';
import { GithubInstallationRepository } from './github-installation.repository';
import { AgentGatewayModule } from '../agent-gateway/agent-gateway.module';

@Module({
  imports: [forwardRef(() => AgentGatewayModule)],
  controllers: [GithubAppController, GithubWebhookController],
  providers: [GithubAppService, GithubInstallationRepository],
  exports: [GithubAppService],
})
export class GithubAppModule {}
