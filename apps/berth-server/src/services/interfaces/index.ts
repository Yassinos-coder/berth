import type { ServiceKind, ServiceState } from '@prisma/client';
import type { ResourceLimits, ServiceSource } from '@berth/protocol';

export type LogStream = 'stdout' | 'stderr' | 'build' | 'system';

export interface LogLine {
  id: string;
  ts: number;
  stream: LogStream;
  line: string;
}

export interface MetricPoint {
  ts: number;
  cpuPct: number;
  memMb: number;
  netRxMb: number;
  netTxMb: number;
}

export interface MetricPeak {
  cpuPct: number;
  memMb: number;
}

export interface ServiceDto {
  id: string;
  name: string;
  kind: ServiceKind;
  state: ServiceState;
  serverId: string;
  serverName: string;
  source: ServiceSource;
  resources: ResourceLimits;
  diskGb?: number;
  replicas: number;
  domain?: string;
  templateKind?: string;
  containerPort?: number;
  registryCredentialId?: string;
  targetPlatform?: string;
  internalDomains: string[];
  usage: { cpuPct: number; memMb: number };
  lastDeployedAt?: string;
  lastSmartResourceAt?: string;
  createdAt: string;
}

export interface ConnectionVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface ConnectionDto {
  available: boolean;
  publicNetworking: boolean;
  scheme?: string;
  username?: string;
  password?: string;
  database?: string;
  host?: string;
  port?: number;
  privateUrl?: string;
  publicUrl?: string;
  sftpUrl?: string;
  variables: ConnectionVariable[];
}
