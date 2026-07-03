import { useQuery } from '@tanstack/react-query';
import { servicesService } from '@/services/servicesService';
import { queryKeys } from '@/lib/queryClient';

export function useServices() {
  return useQuery({
    queryKey: queryKeys.services,
    queryFn: () => servicesService.list(),
  });
}

export function useService(id: string) {
  return useQuery({
    queryKey: queryKeys.service(id),
    queryFn: () => servicesService.getById(id),
    enabled: Boolean(id),
  });
}

export function useServiceLogs(id: string) {
  return useQuery({
    queryKey: queryKeys.serviceLogs(id),
    queryFn: () => servicesService.logs(id),
    enabled: Boolean(id),
    refetchInterval: 5000,
  });
}

export function useServiceMetrics(id: string) {
  return useQuery({
    queryKey: queryKeys.serviceMetrics(id),
    queryFn: () => servicesService.metrics(id),
    enabled: Boolean(id),
    refetchInterval: 10000,
  });
}
