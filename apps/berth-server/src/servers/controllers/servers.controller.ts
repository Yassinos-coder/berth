import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { ServersService } from '../services/servers.service';
import { EnrollServerDto } from '../dto/enroll-server.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { EnrollmentDto, ServerDto } from '../interfaces';

@Controller('servers')
export class ServersController {
  constructor(private readonly serversService: ServersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<ServerDto[]> {
    return this.serversService.list(user.orgId);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ServerDto> {
    return this.serversService.getById(user.orgId, id);
  }

  @Roles(Role.owner, Role.admin)
  @Post('enroll')
  enroll(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: EnrollServerDto,
  ): Promise<EnrollmentDto> {
    return this.serversService.enroll(user, dto.name);
  }

  @Roles(Role.owner, Role.admin)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.serversService.remove(user.orgId, id);
  }
}
