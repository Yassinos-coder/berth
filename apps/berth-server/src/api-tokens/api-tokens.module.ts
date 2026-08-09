import { Module } from '@nestjs/common';
import { ApiTokensController } from './controllers/api-tokens.controller';
import { ApiTokensService } from './services/api-tokens.service';
import { ApiTokenRepository } from './repositories/api-token.repository';

@Module({
  controllers: [ApiTokensController],
  providers: [ApiTokensService, ApiTokenRepository],
  exports: [ApiTokensService],
})
export class ApiTokensModule {}
