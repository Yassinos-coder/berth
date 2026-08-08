import { useQuery } from '@tanstack/react-query';
import { proxyHostsService } from '@/services/proxyHostsService';
import { queryKeys } from '@/lib/queryClient';

export function useProxyHosts() {
  return useQuery({
    queryKey: queryKeys.proxyHosts,
    queryFn: () => proxyHostsService.list(),
  });
}
