import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { notify } from '@/lib/toast';

const SESSIONS_KEY = ['auth', 'sessions'];

export function useSessions() {
  return useQuery({
    queryKey: SESSIONS_KEY,
    queryFn: () => authService.sessions(),
  });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => authService.revokeSession(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      notify.success('Session signed out');
    },
    onError: (error) =>
      notify.error('Could not sign out session', {
        description: error.message,
      }),
  });
}

export function useRevokeOtherSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => authService.revokeOtherSessions(),
    onSuccess: ({ revoked }) => {
      qc.invalidateQueries({ queryKey: SESSIONS_KEY });
      notify.success(
        revoked > 0
          ? `Signed out of ${revoked} other session${revoked === 1 ? '' : 's'}`
          : 'No other sessions to sign out',
      );
    },
    onError: (error) =>
      notify.error('Could not sign out other sessions', {
        description: error.message,
      }),
  });
}
