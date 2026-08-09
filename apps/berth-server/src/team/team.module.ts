import { Module } from '@nestjs/common';
import { TeamController } from './controllers/team.controller';
import { TeamService } from './services/team.service';
import { MemberRepository } from './repositories/member.repository';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ActivityModule, AuthModule],
  controllers: [TeamController],
  providers: [TeamService, MemberRepository],
})
export class TeamModule {}
