import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces';
import { CreateJobDto } from './dto/create-job.dto';
import { RunCommandDto } from './dto/run-command.dto';
import { JobsService } from './jobs.service';

@Controller('services/:serviceId/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser, @Param('serviceId') serviceId: string) { return this.jobs.list(user.orgId, serviceId); }
  @Roles(Role.owner, Role.admin, Role.deployer) @Post() create(@CurrentUser() user: AuthenticatedUser, @Param('serviceId') serviceId: string, @Body() dto: CreateJobDto) { return this.jobs.create(user, serviceId, dto); }
  @Roles(Role.owner, Role.admin, Role.deployer) @Post('run') run(@CurrentUser() user: AuthenticatedUser, @Param('serviceId') serviceId: string, @Body() dto: RunCommandDto) { return this.jobs.run(user, serviceId, dto.command); }
  @Roles(Role.owner, Role.admin, Role.deployer) @Post(':id/run') runJob(@CurrentUser() user: AuthenticatedUser, @Param('serviceId') serviceId: string, @Param('id') id: string) { return this.jobs.run(user, serviceId, [], id); }
  @Roles(Role.owner, Role.admin) @Delete(':id') @HttpCode(204) remove(@CurrentUser() user: AuthenticatedUser, @Param('serviceId') serviceId: string, @Param('id') id: string) { return this.jobs.remove(user.orgId, serviceId, id); }
}
