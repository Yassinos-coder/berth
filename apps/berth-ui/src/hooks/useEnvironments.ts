import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { environmentsService } from '@/services/environmentsService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';

const KEY = ['environments'] as const;

export function useEnvironments() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => environmentsService.list(),
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; preview: boolean }) =>
      environmentsService.create(input.name, input.preview),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
    onError: (error) => notify.error('Could not create environment', { description: error.message }),
  });
}

export function useRemoveEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => environmentsService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
    onError: (error) => notify.error('Could not delete environment', { description: error.message }),
  });
}

export function useAssignEnvironment(serviceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (environmentId: string | null) => environmentsService.assign(serviceId, environmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: queryKeys.service(serviceId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.services });
      notify.success('Environment updated');
    },
    onError: (error) => notify.error('Could not change environment', { description: error.message }),
  });
}
