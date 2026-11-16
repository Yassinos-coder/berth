export interface ReplicaScaleClaimInput {
  serviceId: string;
  serverId: string;
  currentReplicas: number;
  lastReplicaScaleAt: Date | null;
  nextReplicas: number;
  scaledAt: Date;
}

export type ReplicaScaleClaimResult = 'claimed' | 'conflict' | 'capacity';
