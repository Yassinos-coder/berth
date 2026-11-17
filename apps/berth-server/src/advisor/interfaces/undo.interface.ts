export interface UndoRecord {
  serviceId: string;
  cpuCores?: number;
  memoryMb?: number;
  diskGb?: number;
  autoRollback?: boolean;
}
