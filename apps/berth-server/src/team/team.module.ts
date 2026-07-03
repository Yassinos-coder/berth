import { Module } from '@nestjs/common';
import { TeamController } from './controllers/team.controller';
import { TeamService } from './services/team.service';
import { MemberRepository } from './repositories/member.repository';
import { ActivityModule } from '../activity/activity.module';

@Module({
  imports: [ActivityModule],
  controllers: [TeamController],
  providers: [TeamService, MemberRepository],
})
export class TeamModule {}
