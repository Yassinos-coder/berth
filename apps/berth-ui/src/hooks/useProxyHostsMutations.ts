import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  proxyHostsService,
  type CreateProxyHostPayload,
  type UpdateProxyHostPayload,
} from '@/services/proxyHostsService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';

export function useCreateProxyHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProxyHostPayload) =>
      proxyHostsService.create(payload),
    onSuccess: (host) => {
      qc.invalidateQueries({ queryKey: queryKeys.proxyHosts });
      notify.success(`${host.domain} added`, {
        description:
          'Point the domain’s DNS at this server — Caddy issues the certificate automatically.',
      });
    },
    onError: (error) =>
      notify.error('Could not add proxy host', { description: error.message }),
  });
}

export function useUpdateProxyHost(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateProxyHostPayload) =>
      proxyHostsService.update(id, payload),
    onSuccess: (host) => {
      qc.invalidateQueries({ queryKey: queryKeys.proxyHosts });
      qc.invalidateQueries({ queryKey: queryKeys.services });
      notify.success(`${host.domain} updated`, {
        description: 'The proxy applies the change within a few seconds.',
      });
    },
    onError: (error) =>
      notify.error('Could not update proxy host', {
        description: error.message,
      }),
  });
}

export function useRemoveProxyHost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => proxyHostsService.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.proxyHosts });
      notify.success('Proxy host removed');
    },
    onError: (error) =>
      notify.error('Could not remove proxy host', {
        description: error.message,
      }),
  });
}
