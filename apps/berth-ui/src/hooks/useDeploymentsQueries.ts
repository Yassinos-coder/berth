import type { DeploymentStatus } from '@/interfaces';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deploymentsService } from '@/services/deploymentsService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';

export function useDeployments() {
  return useQuery({
    queryKey: queryKeys.deployments,
    queryFn: () => deploymentsService.list(),
  });
}

const IN_FLIGHT: DeploymentStatus[] = ['queued', 'building', 'deploying'];

export function useServiceDeployments(serviceId: string) {
  return useQuery({
    queryKey: queryKeys.serviceDeployments(serviceId),
    queryFn: () => deploymentsService.listForService(serviceId),
    enabled: Boolean(serviceId),
    refetchInterval: (query) =>
      query.state.data?.some((deployment) => IN_FLIGHT.includes(deployment.status)) ? 3000 : false,
  });
}

export function useRollback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (deploymentId: string) =>
      deploymentsService.rollback(deploymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.deployments });
      notify.success('Rollback started');
    },
    onError: (error) =>
      notify.error('Rollback failed', { description: error.message }),
  });
}
