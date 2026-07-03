import type { MemberStatus, Role } from '@prisma/client';

export interface MemberDto {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  avatarUrl?: string;
  lastActive: string;
}
