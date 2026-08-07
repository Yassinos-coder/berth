import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SystemService } from '../services/system.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { SystemVersionDto } from '../interfaces';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('version')
  version(): Promise<SystemVersionDto> {
    return this.systemService.getVersion();
  }

  @Roles(Role.owner, Role.admin)
  @Post('update')
  @HttpCode(202)
  update(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ started: boolean }> {
    return this.systemService.triggerUpdate(user.orgId);
  }
}
