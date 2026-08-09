import { Module } from '@nestjs/common';
import { RegistryCredentialsController } from './controllers/registry-credentials.controller';
import { RegistryCredentialsService } from './services/registry-credentials.service';
import { RegistryCredentialRepository } from './repositories/registry-credential.repository';

@Module({
  controllers: [RegistryCredentialsController],
  providers: [RegistryCredentialsService, RegistryCredentialRepository],
  exports: [RegistryCredentialsService, RegistryCredentialRepository],
})
export class RegistryCredentialsModule {}
