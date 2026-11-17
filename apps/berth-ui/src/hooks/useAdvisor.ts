import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { advisorService, type AdvisorSettingsPayload } from '@/services/advisorService';
import { notify } from '@/lib/toast';

const SUMMARY_KEY = ['advisor', 'summary'] as const;
const SETTINGS_KEY = ['advisor', 'settings'] as const;
const FINDINGS_KEY = ['advisor', 'findings'] as const;

export function useAdvisorSummary(enabled = true) {
  return useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: () => advisorService.summary(),
    enabled,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });
}

export function useAdvisorSettings() {
  return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => advisorService.settings() });
}

export function useAdvisorFindings(view: 'open' | 'history') {
  return useQuery({
    queryKey: [...FINDINGS_KEY, view],
    queryFn: () => advisorService.findings(view),
  });
}

function useRefreshAdvisor() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['advisor'] });
    void queryClient.invalidateQueries({ queryKey: ['services'] });
  };
}

export function useUpdateAdvisorSettings() {
  const refresh = useRefreshAdvisor();
  return useMutation({
    mutationFn: (payload: AdvisorSettingsPayload) => advisorService.updateSettings(payload),
    onSuccess: () => {
      refresh();
      notify.success('Advisor settings saved');
    },
    onError: (error) => notify.error('Could not save advisor settings', { description: error.message }),
  });
}

export function useTestAdvisor() {
  return useMutation({
    mutationFn: () => advisorService.test(),
    onError: (error) => notify.error('Connection test failed', { description: error.message }),
  });
}

export function useRunAdvisor() {
  const refresh = useRefreshAdvisor();
  return useMutation({
    mutationFn: () => advisorService.run(),
    onSuccess: (result) => {
      refresh();
      if (!result.ran) {
        notify.error(result.reason ?? 'The advisor did not run');
        return;
      }
      notify.success(result.findings === 0 ? 'Nothing to suggest right now' : `${result.findings} suggestion(s) ready`, {
        description: result.notice,
      });
    },
    onError: (error) => notify.error('Analysis failed', { description: error.message }),
  });
}

export function useAdvisorFindingActions() {
  const refresh = useRefreshAdvisor();
  const fail = (title: string) => (error: Error) => notify.error(title, { description: error.message });
  return {
    apply: useMutation({
      mutationFn: (id: string) => advisorService.apply(id),
      onSuccess: () => {
        refresh();
        notify.success('Change applied');
      },
      onError: fail('Could not apply the change'),
    }),
    dismiss: useMutation({
      mutationFn: (id: string) => advisorService.dismiss(id),
      onSuccess: refresh,
      onError: fail('Could not dismiss'),
    }),
    undo: useMutation({
      mutationFn: (id: string) => advisorService.undo(id),
      onSuccess: () => {
        refresh();
        notify.success('Change reverted');
      },
      onError: fail('Could not undo the change'),
    }),
  };
}
