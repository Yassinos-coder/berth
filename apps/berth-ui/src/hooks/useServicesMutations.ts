import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  servicesService,
  type CreateServicePayload,
  type ServiceAction,
} from '@/services/servicesService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateServicePayload) =>
      servicesService.create(payload),
    onSuccess: (service) => {
      qc.invalidateQueries({ queryKey: queryKeys.services });
      notify.success(`${service.name} created`, {
        description: 'Reconciling desired state on the agent.',
      });
    },
    onError: (error) =>
      notify.error('Could not create service', { description: error.message }),
  });
}

export function useServiceAction(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (action: ServiceAction) => servicesService.setState(id, action),
    onSuccess: (_res, action) => {
      qc.invalidateQueries({ queryKey: queryKeys.service(id) });
      qc.invalidateQueries({ queryKey: queryKeys.services });
      notify.info(`${action} requested`);
    },
    onError: (error) =>
      notify.error('Action failed', { description: error.message }),
  });
}

export function useRemoveService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.services });
      notify.success('Service deleted');
    },
    onError: (error) =>
      notify.error('Could not delete service', { description: error.message }),
  });
}
