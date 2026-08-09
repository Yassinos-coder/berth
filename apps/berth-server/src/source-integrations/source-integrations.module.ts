import { Module } from '@nestjs/common';
import { SourceIntegrationsController } from './source-integrations.controller';
import { SourceIntegrationsService } from './source-integrations.service';
@Module({ controllers: [SourceIntegrationsController], providers: [SourceIntegrationsService], exports: [SourceIntegrationsService] })
export class SourceIntegrationsModule {}
