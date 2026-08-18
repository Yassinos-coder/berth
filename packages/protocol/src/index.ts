export interface ServiceSpec {
  id: string;
  name: string;
  serverId: string;
  source: ServiceSource;
  env: EnvVar[];
  ports: PortMapping[];
  volumes: VolumeMount[];
  command: string[];
  aliases: string[];
  resources: ResourceLimits;
  healthCheck?: HealthCheck;
  restartPolicy: RestartPolicy;
  replicas: number;
  templateKind?: string;
  registryAuth?: RegistryAuth;
  targetPlatform?: 'linux/amd64' | 'linux/arm64';
}

export interface RegistryAuth {
  server: string;
  username: string;
  password: string;
}

export interface BackupTarget {
  endpoint: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export type ServiceSource =
  | { kind: 'image'; image: string; tag: string }
  | { kind: 'git'; repo: string; branch: string; build: BuildConfig };

export interface BuildConfig {
  builder: 'auto' | 'nixpacks' | 'dockerfile';
  dockerfilePath?: string;
  buildArgs?: Record<string, string>;
  rootDirectory?: string;
  buildCommand?: string;
  startCommand?: string;
  revision?: string;
}

export interface ResourceLimits {
  cpuCores: number;
  memoryMb: number;
  cpuShares?: number;
  pidsLimit?: number;
}

export interface PortMapping {
  containerPort: number;
  domain?: string;
  public: boolean;
}

export interface VolumeMount {
  name: string;
  mountPath: string;
}

export interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface HealthCheck {
  path?: string;
  port?: number;
  intervalSeconds: number;
  timeoutSeconds: number;
  retries: number;
}

export type RestartPolicy = 'no' | 'on-failure' | 'always' | 'unless-stopped';

export type ServiceState =
  | 'building'
  | 'starting'
  | 'running'
  | 'unhealthy'
  | 'stopped'
  | 'crashed';

export interface ServerSpecs {
  hostname: string;
  cpuCores: number;
  memoryMb: number;
  diskGb: number;
  os: string;
}

export interface FailedApply {
  serviceId: string;
  reason: string;
}

export interface ProxyRoute {
  domain: string;
  serviceId: string;
  targetPort: number;
  tls: boolean;
  forceHttps: boolean;
}

export interface PanelRoute {
  domain: string;
}

export type PanelToAgent =
  | {
      type: 'Reconcile';
      services: ServiceSpec[];
      proxies: ProxyRoute[];
      panel?: PanelRoute;
      forceServiceIds?: string[];
    }
  | { type: 'RemoveService'; serviceId: string }
  | { type: 'StreamLogs'; serviceId: string; follow: boolean }
  | { type: 'GetMetrics'; serviceId?: string }
  | { type: 'SelfUpdate' }
  | {
      type: 'RunBackup';
      serviceId: string;
      backupId: string;
      containerName: string;
      dumpCommand: string;
      target: BackupTarget;
      objectKey: string;
    }
  | {
      type: 'RunRestore';
      serviceId: string;
      containerName: string;
      restoreCommand: string;
      target: BackupTarget;
      objectKey: string;
    }
  | { type: 'ExecStart'; sessionId: string; containerName: string }
  | { type: 'ExecInput'; sessionId: string; data: string }
  | { type: 'ExecStop'; sessionId: string }
  | { type: 'ExecResize'; sessionId: string; cols: number; rows: number }
  | { type: 'RunCommand'; runId: string; containerName: string; command: string[] };

export type AgentToPanel =
  | { type: 'Enrolled'; agentId: string; serverSpecs: ServerSpecs }
  | { type: 'ServiceStatus'; serviceId: string; state: ServiceState; containerId?: string; deployed: boolean }
  | { type: 'BuildProgress'; serviceId: string; stage: string; logChunk: string }
  | { type: 'LogChunk'; serviceId: string; line: string; ts: number }
  | {
      type: 'Metrics';
      serviceId: string;
      cpuPct: number;
      memMb: number;
      netRxMb: number;
      netTxMb: number;
    }
  | { type: 'HostUsage'; diskUsedGb: number; diskTotalGb: number }
  | { type: 'ReconcileResult'; applied: string[]; failed: FailedApply[] }
  | {
      type: 'BackupResult';
      backupId: string;
      success: boolean;
      sizeBytes?: number;
      error?: string;
    }
  | { type: 'RestoreResult'; serviceId: string; success: boolean; error?: string }
  | { type: 'ExecOutput'; sessionId: string; data: string }
  | { type: 'ExecExit'; sessionId: string; exitCode: number | null }
  | { type: 'CommandResult'; runId: string; output: string; exitCode: number | null };
