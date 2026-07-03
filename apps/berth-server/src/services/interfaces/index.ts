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
  replicas: number;
  domain?: string;
  usage: { cpuPct: number; memMb: number };
  lastDeployedAt?: string;
  createdAt: string;
}
