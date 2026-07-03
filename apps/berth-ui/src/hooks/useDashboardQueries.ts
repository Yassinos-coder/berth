import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';
import { queryKeys } from '@/lib/queryClient';

export function useDashboardStats() {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => dashboardService.stats(),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: queryKeys.dashboardActivity,
    queryFn: () => dashboardService.activity(),
  });
}
