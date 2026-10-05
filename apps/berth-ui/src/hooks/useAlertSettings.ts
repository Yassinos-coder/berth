import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { alertSettingsService, type AlertSettings } from '@/services/alertSettingsService';
import { notify } from '@/lib/toast';

const KEY = ['alert-settings'] as const;

export function useAlertSettings() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => alertSettingsService.current(),
  });
}

export function useUpdateAlertSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: Partial<AlertSettings>) => alertSettingsService.update(settings),
    onSuccess: (settings) => {
      queryClient.setQueryData(KEY, settings);
      notify.success('Alert settings saved');
    },
    onError: (error) =>
      notify.error('Could not save alert settings', { description: error.message }),
  });
}
