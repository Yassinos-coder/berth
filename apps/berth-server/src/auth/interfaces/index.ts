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

export type LoginOutcome =
  | { mfaRequired: true; mfaToken: string }
  | { mfaRequired: false; session: SessionDto };

export interface TotpSetupDto {
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface TotpStatusDto {
  enabled: boolean;
}

export interface RecoveryCodesDto {
  recoveryCodes: string[];
}

export interface SessionContext {
  userAgent: string;
  ip: string;
}

export interface ActiveSessionDto {
  id: string;
  userAgent: string;
  ip: string;
  createdAt: string;
  lastSeenAt: string;
  current: boolean;
}

export interface InvitePreviewDto {
  email: string;
  name: string;
}
