import type { AgentStatus } from '@prisma/client';

export interface ServerUsageDto {
  cpuPct: number;
  memMb: number;
  memTotalMb: number;
  diskGb: number;
  diskTotalGb: number;
}

import type { StorageSummary } from '../../common/validators/storage-budget.validator';

export interface ServerDto {
  id: string;
  name: string;
  status: AgentStatus;
  ip: string;
  region: string;
  os: string;
  agentVersion: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  serviceCount: number;
  storage: StorageSummary;
  usage: ServerUsageDto;
  lastSeen: string;
  createdAt: string;
}

export interface EnrollmentDto {
  token: string;
  installCommand: string;
  expiresAt: string;
}
