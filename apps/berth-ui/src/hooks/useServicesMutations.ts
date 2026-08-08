import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  servicesService,
  type CreateServicePayload,
  type ServiceAction,
  type UpdateServicePayload,
} from '@/services/servicesService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';
import type { EnvVar } from '@berth/protocol';

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

export function useRenameService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => servicesService.update(id, { name }),
    onSuccess: (service) => {
      qc.invalidateQueries({ queryKey: queryKeys.service(id) });
      qc.invalidateQueries({ queryKey: queryKeys.services });
      notify.success(`Renamed to ${service.name}`);
    },
    onError: (error) =>
      notify.error('Could not rename service', { description: error.message }),
  });
}

export function useUpdateServiceSettings(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateServicePayload) =>
      servicesService.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.service(id) });
      notify.success('Build settings saved', {
        description: 'Redeploy to apply the new configuration.',
      });
    },
    onError: (error) =>
      notify.error('Could not save build settings', {
        description: error.message,
      }),
  });
}

export function useSetServiceEnv(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (env: EnvVar[]) => servicesService.setEnv(id, env),
    onSuccess: (data) => {
      qc.setQueryData([...queryKeys.service(id), 'env'], data);
      notify.success('Variables saved', {
        description: 'Redeploy to apply them to the container.',
      });
    },
    onError: (error) =>
      notify.error('Could not save variables', { description: error.message }),
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
