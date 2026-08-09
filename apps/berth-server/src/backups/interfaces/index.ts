export interface BackupTargetDto {
  id: string;
  name: string;
  endpoint: string;
  bucket: string;
  region: string;
  accessKeyId: string;
  createdAt: string;
}

export interface BackupDto {
  id: string;
  serviceId: string;
  backupTargetId: string;
  backupTargetName: string;
  status: 'running' | 'success' | 'failed';
  sizeBytes?: number;
  errorMessage?: string;
  startedAt: string;
  finishedAt?: string;
}
