import { Module } from '@nestjs/common';
import { StatusPagesController } from './status-pages.controller';
import { StatusPagesService } from './status-pages.service';
@Module({ controllers: [StatusPagesController], providers: [StatusPagesService] })
export class StatusPagesModule {}
