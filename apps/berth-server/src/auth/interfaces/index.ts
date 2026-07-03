import type { Role } from '@prisma/client';

export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
}

export interface SessionDto {
  user: AuthUserDto;
  token: string;
}

export interface SetupStateDto {
  needsSetup: boolean;
}
