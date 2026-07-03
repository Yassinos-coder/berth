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
import { TeamService } from '../services/team.service';
import { InviteMemberDto, UpdateRoleDto } from '../dto/invite-member.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { MemberDto } from '../interfaces';

@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<MemberDto[]> {
    return this.teamService.list(user.orgId);
  }

  @Roles(Role.owner, Role.admin)
  @Post('invite')
  invite(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InviteMemberDto,
  ): Promise<MemberDto> {
    return this.teamService.invite(user, dto.email, dto.role);
  }

  @Roles(Role.owner, Role.admin)
  @Patch(':id')
  updateRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
  ): Promise<MemberDto> {
    return this.teamService.updateRole(user, id, dto.role);
  }

  @Roles(Role.owner, Role.admin)
  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.teamService.remove(user, id);
  }
}
