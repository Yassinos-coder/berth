import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { BackupTargetsService } from '../services/backup-targets.service';
import { CreateBackupTargetDto } from '../dto/create-backup-target.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { BackupTargetDto } from '../interfaces';

@Controller('backup-targets')
export class BackupTargetsController {
  constructor(private readonly service: BackupTargetsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<BackupTargetDto[]> {
    return this.service.list(user.orgId);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateBackupTargetDto,
  ): Promise<BackupTargetDto> {
    return this.service.create(user.orgId, dto);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.service.remove(user.orgId, id);
  }
}
