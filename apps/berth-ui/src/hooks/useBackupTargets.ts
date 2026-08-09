import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  backupTargetsService,
  type CreateBackupTargetPayload,
} from '@/services/backupTargetsService';
import { notify } from '@/lib/toast';

const BACKUP_TARGETS_KEY = ['backup-targets'];

export function useBackupTargets() {
  return useQuery({
    queryKey: BACKUP_TARGETS_KEY,
    queryFn: () => backupTargetsService.list(),
  });
}

export function useCreateBackupTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBackupTargetPayload) =>
      backupTargetsService.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BACKUP_TARGETS_KEY });
      notify.success('Backup target added');
    },
    onError: (error) =>
      notify.error('Could not add backup target', {
        description: error.message,
      }),
  });
}

export function useRemoveBackupTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => backupTargetsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BACKUP_TARGETS_KEY });
      notify.success('Backup target removed');
    },
    onError: (error) =>
      notify.error('Could not remove backup target', {
        description: error.message,
      }),
  });
}
