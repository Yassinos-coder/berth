import { Module } from '@nestjs/common';
import { ServicesModule } from '../services/services.module';
import { ComposeController } from './compose.controller';
import { ComposeService } from './compose.service';
@Module({ imports: [ServicesModule], controllers: [ComposeController], providers: [ComposeService] })
export class ComposeModule {}
