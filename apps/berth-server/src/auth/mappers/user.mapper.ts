import { User } from '@prisma/client';
import type { AuthUserDto } from '../interfaces';

export class UserMapper {
  static toAuthUser(user: User): AuthUserDto {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl ?? undefined,
    };
  }
}
