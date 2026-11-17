import type {
  AdvisorAction,
  AdvisorFindingKind,
  AdvisorFindingSource,
  AdvisorSeverity,
} from '@berth/protocol';

export interface RawServer {
  id: string;
  name: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  status: string;
  storageBudgetGb: number | null;
  allocatedDiskGb: number;
}

export interface RawService {
  id: string;
  name: string;
  kind: string;
  state: string;
  sourceKind: string;
  image?: string | null;
  tag?: string | null;
  replicas: number;
  cpuCores: number;
  memoryMb: number;
  deployStrategy: string;
  autoRollback: boolean;
  volumePath?: string | null;
  diskGb?: number | null;
  volumeLimited: boolean;
  serverId: string;
  templateKind?: string | null;
  previewsEnabled: boolean;
}

export interface RawMetric {
  serviceId: string;
  peakCpuPct: number;
  peakMemMb: number;
  avgCpuPct: number;
  avgMemMb: number;
  samples: number;
}

export interface RawDeployStats {
  serviceId: string;
  total: number;
  failed: number;
}

export interface RawProxyHost {
  serviceId: string;
  ssl: boolean;
}

export interface RawOrgData {
  now: Date;
  servers: RawServer[];
  services: RawService[];
  metrics: RawMetric[];
  deployStats: RawDeployStats[];
  proxyHosts: RawProxyHost[];
  backupTargets: number;
  servicesWithBackup: string[];
}

export interface SnapshotService {
  id: string;
  name: string;
  kind: string;
  state: string;
  source: { kind: string; image?: string; tag?: string };
  replicas: number;
  cpuCores: number;
  memoryMb: number;
  deployStrategy: string;
  autoRollback: boolean;
  storage: { mounted: boolean; sizeGb?: number; limited: boolean };
  serverId: string;
  usage?: { peakMemMb: number; avgMemMb: number; peakCpuPct: number; avgCpuPct: number; samples: number };
  deployments7d: { total: number; failed: number };
  domains: { count: number; allHttps: boolean };
  hasBackup: boolean;
}

export interface SnapshotServer {
  id: string;
  name: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  status: string;
  storage: { budgetGb: number | null; allocatedGb: number };
}

export interface AdvisorSnapshot {
  generatedAt: string;
  windowDays: number;
  servers: SnapshotServer[];
  services: SnapshotService[];
  backupTargets: number;
}

export interface CandidateFinding {
  fingerprint: string;
  kind: AdvisorFindingKind;
  severity: AdvisorSeverity;
  source: AdvisorFindingSource;
  title: string;
  detail: string;
  evidence: string[];
  serviceId?: string;
  serverId?: string;
  action?: AdvisorAction;
}

export type { UndoRecord } from './undo.interface';
