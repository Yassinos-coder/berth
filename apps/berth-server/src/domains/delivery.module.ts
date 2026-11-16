import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { DeploymentsModule } from '../deployments/deployments.module';
import { TemplatesModule } from '../templates/templates.module';
import { ComposeModule } from '../compose/compose.module';
import { EnvironmentsModule } from '../environments/environments.module';
import { RegistryModule } from '../registry/registry.module';
import { RegistryCredentialsModule } from '../registry-credentials/registry-credentials.module';
import { GithubAppModule } from '../github-app/github-app.module';
import { SourceIntegrationsModule } from '../source-integrations/source-integrations.module';

@Module({
  imports: [
    ServicesModule,
    DeploymentsModule,
    TemplatesModule,
    ComposeModule,
    EnvironmentsModule,
    RegistryModule,
    RegistryCredentialsModule,
    GithubAppModule,
    SourceIntegrationsModule,
  ],
  exports: [
    ServicesModule,
    DeploymentsModule,
    TemplatesModule,
    ComposeModule,
    EnvironmentsModule,
    RegistryModule,
    RegistryCredentialsModule,
    GithubAppModule,
    SourceIntegrationsModule,
  ],
})
export class DeliveryModule {}
