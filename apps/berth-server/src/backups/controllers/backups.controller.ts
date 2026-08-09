import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BackupsService } from '../services/backups.service';
import { CreateBackupDto } from '../dto/create-backup.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { BackupDto } from '../interfaces';

@Controller('services/:serviceId/backups')
export class BackupsController {
  constructor(private readonly service: BackupsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId') serviceId: string,
  ): Promise<BackupDto[]> {
    return this.service.list(user.orgId, serviceId);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId') serviceId: string,
    @Body() dto: CreateBackupDto,
  ): Promise<BackupDto> {
    return this.service.create(user, serviceId, dto);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post(':backupId/restore')
  @HttpCode(200)
  async restore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('serviceId') serviceId: string,
    @Param('backupId') backupId: string,
  ): Promise<{ ok: boolean }> {
    await this.service.restore(user, serviceId, backupId);
    return { ok: true };
  }
}
