import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { systemService } from '@/services/systemService';
import { notify } from '@/lib/toast';

export function useVersion() {
  return useQuery({
    queryKey: ['system', 'version'],
    queryFn: () => systemService.version(),
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: false,
  });
}

export function useStartUpdate() {
  return useMutation({
    mutationFn: () => systemService.update(),
    onSuccess: () =>
      notify.info('Update started', {
        description: 'The panel will restart briefly — deployed services keep running.',
      }),
    onError: (error) =>
      notify.error('Could not start the update', {
        description: error.message,
      }),
  });
}

export function useResourceSettings() {
  return useQuery({
    queryKey: ['system', 'resource-settings'],
    queryFn: () => systemService.resourceSettings(),
  });
}

export function useUpdateResourceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      systemService.updateResourceSettings(enabled),
    onSuccess: (settings) => {
      queryClient.setQueryData(['system', 'resource-settings'], settings);
      notify.success(`Smart resources ${settings.enabled ? 'enabled' : 'disabled'}`);
    },
    onError: (error) =>
      notify.error('Could not update smart resources', {
        description: error.message,
      }),
  });
}

export function usePanelDomain() {
  return useQuery({
    queryKey: ['system', 'panel-domain'],
    queryFn: () => systemService.panelDomain(),
  });
}

export function useUpdatePanelDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (domain: string) => systemService.updatePanelDomain(domain),
    onSuccess: (settings) => {
      queryClient.setQueryData(['system', 'panel-domain'], settings);
      notify.success(
        settings.domain ? 'Panel domain configured' : 'Panel domain removed',
        settings.domain
          ? { description: `HTTPS is being provisioned for ${settings.domain}.` }
          : undefined,
      );
    },
    onError: (error) =>
      notify.error('Could not update panel domain', {
        description: error.message,
      }),
  });
}
