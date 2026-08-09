import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import { EnvironmentsService } from './environments.service';

export class CreateEnvironmentDto { @IsString() @MaxLength(80) name!: string; @IsOptional() @IsBoolean() isProduction?: boolean; @IsOptional() @IsBoolean() preview?: boolean; }
export class AssignEnvironmentDto { @IsOptional() @IsString() environmentId?: string; }

@Controller('environments')
export class EnvironmentsController {
  constructor(private readonly environments: EnvironmentsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.environments.list(user.orgId); }
  @Roles(Role.owner, Role.admin) @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEnvironmentDto) { return this.environments.create(user.orgId, dto); }
  @Roles(Role.owner, Role.admin) @Delete(':id') @HttpCode(204) remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.environments.remove(user.orgId, id); }
  @Roles(Role.owner, Role.admin, Role.deployer) @Patch(':id/services/:serviceId') assign(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('serviceId') serviceId: string) { return this.environments.assign(user.orgId, serviceId, id); }
}
