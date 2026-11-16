import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TeamModule } from '../team/team.module';
import { ApiTokensModule } from '../api-tokens/api-tokens.module';
import { OpenApiModule } from '../openapi/openapi.module';

@Module({
  imports: [AuthModule, TeamModule, ApiTokensModule, OpenApiModule],
  exports: [AuthModule, TeamModule, ApiTokensModule, OpenApiModule],
})
export class AccessModule {}
