export interface BerthConfig {
  url: string;
  token: string;
}

export interface ServiceSummary {
  id: string;
  name: string;
  kind: string;
  state: string;
  serverName: string;
  domain?: string;
  source: { kind: 'git' | 'image'; repo?: string; branch?: string; image?: string; tag?: string };
}

export interface LogLine {
  id: string;
  ts: number;
  stream: string;
  line: string;
}

export interface DeploymentSummary {
  id: string;
  serviceId: string;
  serviceName?: string;
  status: string;
  trigger?: string;
  commitSha?: string;
  createdAt: string;
}

export interface EnvEntry {
  key: string;
  value: string;
  isSecret: boolean;
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'redeploy';
