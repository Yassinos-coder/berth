import type { Role } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  orgId: string;
  role: Role;
  type?: 'session';
  sid?: string;
}

export interface MfaChallengePayload {
  sub: string;
  type: 'mfa_challenge';
}

export interface AuthenticatedUser {
  id: string;
  orgId: string;
  role: Role;
}

export interface RequestWithUser {
  user: AuthenticatedUser;
}
