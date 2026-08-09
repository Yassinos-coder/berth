import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { Role } from '@prisma/client';
import { RegistryCredentialsService } from '../services/registry-credentials.service';
import { CreateRegistryCredentialDto } from '../dto/create-registry-credential.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { RegistryCredentialDto } from '../interfaces';

@Controller('registry-credentials')
export class RegistryCredentialsController {
  constructor(private readonly service: RegistryCredentialsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<RegistryCredentialDto[]> {
    return this.service.list(user.orgId);
  }

  @Roles(Role.owner, Role.admin, Role.deployer)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRegistryCredentialDto,
  ): Promise<RegistryCredentialDto> {
    return this.service.create(user, dto);
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
