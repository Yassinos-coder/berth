import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: Role;
}

export interface AuthenticatedUser {
  id: string;
  orgId: string;
  role: Role;
}

export interface RequestWithUser {
  user: AuthenticatedUser;
}
