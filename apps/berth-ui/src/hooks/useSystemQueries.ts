import { useMutation, useQuery } from '@tanstack/react-query';
import { systemService } from '@/services/systemService';
import { notify } from '@/lib/toast';

export function useVersion() {
  return useQuery({
    queryKey: ['system', 'version'],
    queryFn: () => systemService.version(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: false,
  });
}

export function useStartUpdate() {
  return useMutation({
    mutationFn: () => systemService.update(),
    onSuccess: () =>
      notify.info('Update started', {
        description: 'The panel will restart briefly — deployed services keep running.',
      }),
    onError: (error) =>
      notify.error('Could not start the update', {
        description: error.message,
      }),
  });
}
