import { useQuery } from '@tanstack/react-query';
import { serversService } from '@/services/serversService';
import { queryKeys } from '@/lib/queryClient';

export function useServers() {
  return useQuery({
    queryKey: queryKeys.servers,
    queryFn: () => serversService.list(),
  });
}

export function useServer(id: string) {
  return useQuery({
    queryKey: queryKeys.server(id),
    queryFn: () => serversService.getById(id),
    enabled: Boolean(id),
  });
}
