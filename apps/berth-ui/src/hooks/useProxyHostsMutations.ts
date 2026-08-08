import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  proxyHostsService,
  type CreateProxyHostPayload,
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
