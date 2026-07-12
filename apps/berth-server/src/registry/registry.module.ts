import { Module } from '@nestjs/common';
import { RegistryController } from './controllers/registry.controller';
import { RegistryService } from './services/registry.service';

@Module({
  controllers: [RegistryController],
  providers: [RegistryService],
})
export class RegistryModule {}
