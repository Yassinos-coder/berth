import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditController } from './audit.controller';
import { AuditInterceptor } from './audit.interceptor';
@Module({ controllers: [AuditController], providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }] })
export class AuditModule {}
