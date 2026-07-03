import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityRepository } from './activity.repository';

@Module({
  providers: [ActivityService, ActivityRepository],
  exports: [ActivityService],
})
export class ActivityModule {}
