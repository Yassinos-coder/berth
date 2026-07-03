import { User } from '@prisma/client';
import type { MemberDto } from '../interfaces';

export class MemberMapper {
  static toDto(user: User): MemberDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl ?? undefined,
      lastActive: user.lastActiveAt.toISOString(),
    };
  }
}
