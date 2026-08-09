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
import { NotificationChannelsService } from '../services/notification-channels.service';
import { CreateNotificationChannelDto } from '../dto/create-notification-channel.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { NotificationChannelDto } from '../interfaces';

@Controller('notification-channels')
export class NotificationChannelsController {
  constructor(private readonly service: NotificationChannelsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<NotificationChannelDto[]> {
    return this.service.list(user.orgId);
  }

  @Roles(Role.owner, Role.admin)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateNotificationChannelDto,
  ): Promise<NotificationChannelDto> {
    return this.service.create(user.orgId, dto);
  }

  @Roles(Role.owner, Role.admin)
  @Patch(':id')
  async setEnabled(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('enabled') enabled: boolean,
  ): Promise<{ ok: boolean }> {
    await this.service.setEnabled(user.orgId, id, enabled);
    return { ok: true };
  }

  @Roles(Role.owner, Role.admin)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.remove(user.orgId, id);
  }
}
