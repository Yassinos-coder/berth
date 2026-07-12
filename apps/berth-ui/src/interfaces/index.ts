import type {
  ServiceSpec,
  ServiceSource,
  ServiceState,
  ResourceLimits,
} from '@berth/protocol';

export type Role = 'owner' | 'admin' | 'deployer' | 'viewer';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string;
}

export type AgentStatus = 'online' | 'offline' | 'enrolling' | 'degraded';

export interface ServerUsage {
  cpuPct: number;
  memMb: number;
  memTotalMb: number;
  diskGb: number;
  diskTotalGb: number;
}

export interface Server {
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
  usage: ServerUsage;
  lastSeen: string;
  createdAt: string;
}

export type ServiceKind = 'image' | 'git' | 'database' | 'bucket';

export interface ServiceUsage {
  cpuPct: number;
  memMb: number;
}

export interface Service {
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
  templateKind?: string;
  usage: ServiceUsage;
  lastDeployedAt?: string;
  createdAt: string;
}

export interface RegistryImage {
  name: string;
  description: string;
  official: boolean;
  stars: number;
  pulls: number;
  templateKind?: string;
}

export interface RegistryTag {
  name: string;
  sizeMb?: number;
  lastUpdated?: string;
}

export interface ConnectionVariable {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface Connection {
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
  variables: ConnectionVariable[];
}

export type DeploymentStatus =
  | 'queued'
  | 'building'
  | 'deploying'
  | 'live'
  | 'failed'
  | 'canceled';

export interface Deployment {
  id: string;
  serviceId: string;
  serviceName: string;
  status: DeploymentStatus;
  trigger: 'push' | 'manual' | 'rollback' | 'redeploy';
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
  author?: string;
  durationSeconds?: number;
  createdAt: string;
}

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

export interface Template {
  id: string;
  name: string;
  description: string;
  category: 'database' | 'storage' | 'cache' | 'app' | 'tooling';
  icon: string;
  accent: string;
  official: boolean;
}

export type MemberStatus = 'active' | 'invited' | 'suspended';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: MemberStatus;
  avatarUrl?: string;
  lastActive: string;
}

export interface Enrollment {
  token: string;
  installCommand: string;
  expiresAt: string;
}

export interface DashboardStats {
  servers: number;
  serversOnline: number;
  services: number;
  servicesRunning: number;
  deploymentsToday: number;
  avgCpuPct: number;
  avgMemPct: number;
}

export interface ActivityItem {
  id: string;
  kind: 'deploy' | 'server' | 'member' | 'system';
  title: string;
  detail: string;
  actor: string;
  createdAt: string;
}

export type { ServiceSpec, ServiceSource, ServiceState, ResourceLimits };
