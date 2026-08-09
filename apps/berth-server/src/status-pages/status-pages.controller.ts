import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsArray, IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import { StatusPagesService } from './status-pages.service';

export class CreateStatusPageDto { @IsString() @MaxLength(80) title!: string; @IsString() @MaxLength(80) slug!: string; @IsOptional() @IsString() @MaxLength(500) description?: string; @IsArray() @IsString({ each: true }) serviceIds!: string[]; }
export class CreateIncidentDto { @IsString() @MaxLength(120) title!: string; @IsString() @MaxLength(2000) message!: string; }
@Controller()
export class StatusPagesController {
  constructor(private readonly pages: StatusPagesService) {}
  @Public() @Get('status/:slug') publicPage(@Param('slug') slug: string) { return this.pages.publicPage(slug); }
  @Get('status-pages') list(@CurrentUser() user: AuthenticatedUser) { return this.pages.list(user.orgId); }
  @Roles(Role.owner, Role.admin) @Post('status-pages') create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStatusPageDto) { return this.pages.create(user.orgId, dto); }
  @Roles(Role.owner, Role.admin) @Post('status-pages/:id/incidents') incident(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: CreateIncidentDto) { return this.pages.incident(user.orgId, id, dto); }
  @Roles(Role.owner, Role.admin) @Patch('status-pages/:id/incidents/:incidentId/resolve') resolve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('incidentId') incidentId: string) { return this.pages.resolve(user.orgId, id, incidentId); }
}
