import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ProxyHostsService } from '../services/proxy-hosts.service';
import { CreateProxyHostDto } from '../dto/create-proxy-host.dto';
import { UpdateProxyHostDto } from '../dto/update-proxy-host.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { ProxyHostDto } from '../interfaces';

@Controller('proxy-hosts')
export class ProxyHostsController {
  constructor(private readonly proxyHostsService: ProxyHostsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ProxyHostDto[]> {
    return this.proxyHostsService.list(user.orgId);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateProxyHostDto,
  ): Promise<ProxyHostDto> {
    return this.proxyHostsService.create(user, dto);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProxyHostDto,
  ): Promise<ProxyHostDto> {
    return this.proxyHostsService.update(user, id, dto);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.proxyHostsService.remove(user.orgId, id);
  }
}
