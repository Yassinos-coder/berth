import { Body, Controller, Get, Patch } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import { UpdateAlertSettingsDto } from '../dto/update-alert-settings.dto';
import type { AlertThresholds } from '../interfaces';
import { AlertSettingsService } from '../services/alert-settings.service';

@Controller('alert-settings')
export class AlertSettingsController {
  constructor(private readonly settings: AlertSettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<AlertThresholds> {
    return this.settings.get(user.orgId);
  }

  @Roles(Role.owner, Role.admin)
  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAlertSettingsDto,
  ): Promise<AlertThresholds> {
    return this.settings.update(user.orgId, dto);
  }
}
