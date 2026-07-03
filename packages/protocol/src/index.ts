export interface ServiceSpec {
  id: string;
  name: string;
  serverId: string;
  source: ServiceSource;
  env: EnvVar[];
  ports: PortMapping[];
  volumes: VolumeMount[];
  resources: ResourceLimits;
  healthCheck?: HealthCheck;
  restartPolicy: RestartPolicy;
  replicas: number;
}

export type ServiceSource =
  | { kind: 'image'; image: string; tag: string }
  | { kind: 'git'; repo: string; branch: string; build: BuildConfig };

export interface BuildConfig {
  builder: 'auto' | 'nixpacks' | 'dockerfile';
  dockerfilePath?: string;
  buildArgs?: Record<string, string>;
  rootDirectory?: string;
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

export type PanelToAgent =
  | { type: 'Reconcile'; services: ServiceSpec[] }
  | { type: 'RemoveService'; serviceId: string }
  | { type: 'StreamLogs'; serviceId: string; follow: boolean }
  | { type: 'GetMetrics'; serviceId?: string };

export type AgentToPanel =
  | { type: 'Enrolled'; agentId: string; serverSpecs: ServerSpecs }
  | { type: 'ServiceStatus'; serviceId: string; state: ServiceState; containerId?: string }
  | { type: 'BuildProgress'; serviceId: string; stage: string; logChunk: string }
  | { type: 'LogChunk'; serviceId: string; line: string; ts: number }
  | { type: 'Metrics'; serviceId: string; cpuPct: number; memMb: number }
  | { type: 'ReconcileResult'; applied: string[]; failed: FailedApply[] };
