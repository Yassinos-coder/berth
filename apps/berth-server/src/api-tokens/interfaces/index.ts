import type { Role } from '@prisma/client';

export interface ApiTokenDto {
  id: string;
  name: string;
  tokenPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export interface CreatedApiTokenDto extends ApiTokenDto {
  token: string;
}

export interface AuthenticatedApiToken {
  id: string;
  orgId: string;
  userId: string;
  role: Role;
  expiresAt: Date | null;
}
