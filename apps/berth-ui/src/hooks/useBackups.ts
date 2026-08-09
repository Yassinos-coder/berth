import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { backupsService } from '@/services/backupsService';
import { notify } from '@/lib/toast';

const backupsKey = (serviceId: string) => ['backups', serviceId];

export function useBackups(serviceId: string) {
  return useQuery({
    queryKey: backupsKey(serviceId),
    queryFn: () => backupsService.list(serviceId),
    refetchInterval: 5000,
  });
}

export function useCreateBackup(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (backupTargetId: string) =>
      backupsService.create(serviceId, backupTargetId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupsKey(serviceId) });
      notify.success('Backup started');
    },
    onError: (error) =>
      notify.error('Could not start backup', { description: error.message }),
  });
}

export function useRestoreBackup(serviceId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (backupId: string) => backupsService.restore(serviceId, backupId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupsKey(serviceId) });
      notify.info('Restore started', {
        description: 'Check Recent Activity for the outcome.',
      });
    },
    onError: (error) =>
      notify.error('Could not start restore', { description: error.message }),
  });
}
