import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  ServicesService,
  type ServiceAction,
} from '../services/services.service';
import { ConnectionService } from '../services/connection.service';
import { CreateServiceDto } from '../dto/create-service.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type {
  ConnectionDto,
  LogLine,
  MetricPoint,
  ServiceDto,
} from '../interfaces';

const ACTIONS: ServiceAction[] = ['start', 'stop', 'restart', 'redeploy'];

@Controller('services')
export class ServicesController {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly connectionService: ConnectionService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ServiceDto[]> {
    return this.servicesService.list(user.orgId);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Get(':id/connection')
  connection(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ConnectionDto> {
    return this.connectionService.get(user.orgId, id);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ServiceDto> {
    return this.servicesService.getById(user.orgId, id);
  }

  @Get(':id/logs')
  logs(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<LogLine[]> {
    return this.servicesService.logs(user.orgId, id);
  }

  @Get(':id/metrics')
  metrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<MetricPoint[]> {
    return this.servicesService.metrics(user.orgId, id);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServiceDto,
  ): Promise<ServiceDto> {
    return this.servicesService.create(user, dto);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post(':id/:action')
  runAction(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('action') action: string,
  ): Promise<{ ok: boolean }> {
    if (!ACTIONS.includes(action as ServiceAction)) {
      throw new BadRequestException(`Unknown action "${action}"`);
    }
    return this.servicesService.runAction(user, id, action as ServiceAction);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.servicesService.remove(user.orgId, id);
  }
}
