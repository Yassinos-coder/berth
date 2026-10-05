import { useQuery } from '@tanstack/react-query';
import { proxyHostsService } from '@/services/proxyHostsService';
import { queryKeys } from '@/lib/queryClient';

export function useProxyHosts() {
  return useQuery({
    queryKey: queryKeys.proxyHosts,
    queryFn: () => proxyHostsService.list(),
  });
}

const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function useDnsCheck(domain: string, serviceId: string) {
  const name = domain.trim().toLowerCase();
  return useQuery({
    queryKey: queryKeys.dnsCheck(name, serviceId),
    queryFn: () => proxyHostsService.dnsCheck(name, serviceId),
    enabled: DOMAIN_PATTERN.test(name) && Boolean(serviceId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
}
