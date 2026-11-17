import { useMutation, useQueryClient } from '@tanstack/react-query';
import { serversService } from '@/services/serversService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';

export function useEnrollServer() {
  return useMutation({
    mutationFn: (name: string) => serversService.enroll(name),
    onError: (error) =>
      notify.error('Could not create enrollment', {
        description: error.message,
      }),
  });
}

export function useUpdateServerStorage(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (storageBudgetGb: number) => serversService.updateStorage(id, storageBudgetGb),
    onSuccess: (server) => {
      qc.invalidateQueries({ queryKey: queryKeys.servers });
      qc.invalidateQueries({ queryKey: queryKeys.server(id) });
      notify.success('Storage budget updated', {
        description: `Berth may now use up to ${server.storage?.budgetGb ?? ''} GB on ${server.name}.`,
      });
    },
    onError: (error) =>
      notify.error('Could not update the storage budget', { description: error.message }),
  });
}

export function useReenrollServer() {
  return useMutation({
    mutationFn: (id: string) => serversService.reenroll(id),
    onError: (error) =>
      notify.error('Could not regenerate token', {
        description: error.message,
      }),
  });
}

export function useRemoveServer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => serversService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.servers });
      notify.success('Server removed');
    },
    onError: (error) =>
      notify.error('Failed to remove server', { description: error.message }),
  });
}
