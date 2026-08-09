import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { GitProvider, Role } from '@prisma/client';
import { IsEnum, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import { SourceIntegrationsService } from './source-integrations.service';

export class CreateSourceIntegrationDto {
  @IsEnum(GitProvider) provider!: GitProvider;
  @IsString() @MaxLength(80) name!: string;
  @IsString() @MinLength(1) host!: string;
  @IsString() @MinLength(1) username!: string;
  @IsString() @MinLength(8) token!: string;
}
@Controller('source-integrations')
export class SourceIntegrationsController {
  constructor(private readonly service: SourceIntegrationsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.service.list(user.orgId); }
  @Roles(Role.owner, Role.admin) @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSourceIntegrationDto) { return this.service.create(user.orgId, dto); }
  @Roles(Role.owner, Role.admin) @Delete(':id') @HttpCode(204) remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.remove(user.orgId, id); }
}
