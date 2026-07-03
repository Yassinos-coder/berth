import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { ActivityKind, Role } from '@prisma/client';
import { MemberRepository } from '../repositories/member.repository';
import { MemberMapper } from '../mappers/member.mapper';
import { ActivityService } from '../../activity/activity.service';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { MemberDto } from '../interfaces';

@Injectable()
export class TeamService {
  constructor(
    private readonly repository: MemberRepository,
    private readonly activityService: ActivityService,
  ) {}

  async list(orgId: string): Promise<MemberDto[]> {
    const members = await this.repository.listByOrg(orgId);
    return members.map(MemberMapper.toDto);
  }

  async invite(
    user: AuthenticatedUser,
    email: string,
    role: Role,
  ): Promise<MemberDto> {
    const normalized = email.toLowerCase();
    const existing = await this.repository.findByEmail(normalized);
    if (existing) throw new BadRequestException('That email is already a member');

    const placeholderHash = await argon2.hash(randomBytes(24).toString('hex'));
    const member = await this.repository.invite({
      orgId: user.orgId,
      email: normalized,
      name: normalized.split('@')[0],
      role,
      passwordHash: placeholderHash,
    });

    await this.activityService.record(user.orgId, {
      kind: ActivityKind.member,
      title: `${normalized} invited`,
      detail: `Role: ${role}`,
      actor: user.id,
    });
    return MemberMapper.toDto(member);
  }

  async updateRole(
    user: AuthenticatedUser,
    id: string,
    role: Role,
  ): Promise<MemberDto> {
    const member = await this.repository.findInOrg(user.orgId, id);
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === Role.owner) {
      throw new ForbiddenException('The owner role cannot be changed');
    }
    const updated = await this.repository.updateRole(user.orgId, id, role);
    return MemberMapper.toDto(updated);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const member = await this.repository.findInOrg(user.orgId, id);
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === Role.owner) {
      throw new ForbiddenException('The owner cannot be removed');
    }
    await this.repository.delete(user.orgId, id);
  }
}
