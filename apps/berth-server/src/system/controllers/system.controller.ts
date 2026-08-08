import { Body, Controller, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SystemService } from '../services/system.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { SystemVersionDto } from '../interfaces';
import { UpdateResourceSettingsDto } from '../dto/update-resource-settings.dto';
import { UpdatePanelDomainDto } from '../dto/update-panel-domain.dto';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get('version')
  version(): Promise<SystemVersionDto> {
    return this.systemService.getVersion();
  }

  @Get('resource-settings')
  resourceSettings(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ enabled: boolean }> {
    return this.systemService.getResourceSettings(user.orgId);
  }

  @Roles(Role.owner, Role.admin)
  @Patch('resource-settings')
  updateResourceSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateResourceSettingsDto,
  ): Promise<{ enabled: boolean }> {
    return this.systemService.updateResourceSettings(user.orgId, dto.enabled);
  }

  @Get('panel-domain')
  panelDomain(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ domain: string }> {
    return this.systemService.getPanelDomain(user.orgId);
  }

  @Roles(Role.owner, Role.admin)
  @Patch('panel-domain')
  updatePanelDomain(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdatePanelDomainDto,
  ): Promise<{ domain: string }> {
    return this.systemService.updatePanelDomain(user.orgId, dto.domain);
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
