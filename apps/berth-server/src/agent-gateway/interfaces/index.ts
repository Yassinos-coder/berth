export interface AgentIdentitySnapshot {
  certSerial: string | null;
  pendingCertSerial: string | null;
  bootstrapToken: string | null;
}

export interface AutoRollbackCandidate {
  id: string;
  status: string;
  trigger: string;
  commitSha: string | null;
  branch?: string | null;
  createdAt: Date;
  durationSeconds: number | null;
}

export interface AutoRollbackInput {
  autoRollback: boolean;
  sourceKind: string;
  now: Date;
  windowMs?: number;
  deployments: AutoRollbackCandidate[];
}
