import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dashboardService } from '@/services/dashboardService';
import { queryKeys } from '@/lib/queryClient';
import { notify } from '@/lib/toast';

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

export function useClearActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => dashboardService.clearActivity(),
    onSuccess: () => {
      qc.setQueryData(queryKeys.dashboardActivity, []);
      notify.success('Activity cleared');
    },
    onError: (error) =>
      notify.error('Could not clear activity', { description: error.message }),
  });
}
