import { BaseApiClient } from '@/services/baseApiClient';
import type { BackupTarget } from '@/interfaces';

export interface CreateBackupTargetPayload {
  name: string;
  endpoint: string;
  bucket: string;
  region?: string;
  accessKeyId: string;
  secretAccessKey: string;
}

class BackupTargetsService extends BaseApiClient {
  protected resource = 'backup-targets';

  list(): Promise<BackupTarget[]> {
    return this.get<BackupTarget[]>('');
  }

  create(payload: CreateBackupTargetPayload): Promise<BackupTarget> {
    return this.post<BackupTarget>('', payload);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const backupTargetsService = new BackupTargetsService();
