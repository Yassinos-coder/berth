import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/authService';
import { notify } from '@/lib/toast';

const TOTP_STATUS_KEY = ['auth', 'totp-status'];

export function useTotpStatus() {
  return useQuery({
    queryKey: TOTP_STATUS_KEY,
    queryFn: () => authService.totpStatus(),
  });
}

export function useSetupTotp() {
  return useMutation({
    mutationFn: () => authService.setupTotp(),
    onError: (error) =>
      notify.error('Could not start two-factor setup', {
        description: error.message,
      }),
  });
}

export function useConfirmTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => authService.confirmTotp(code),
    onSuccess: () => {
      qc.setQueryData(TOTP_STATUS_KEY, { enabled: true });
      notify.success('Two-factor authentication enabled');
    },
    onError: (error) =>
      notify.error('Invalid verification code', {
        description: error.message,
      }),
  });
}

export function useDisableTotp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => authService.disableTotp(password),
    onSuccess: () => {
      qc.setQueryData(TOTP_STATUS_KEY, { enabled: false });
      notify.success('Two-factor authentication disabled');
    },
    onError: (error) =>
      notify.error('Could not disable two-factor authentication', {
        description: error.message,
      }),
  });
}

export function useRegenerateRecoveryCodes() {
  return useMutation({
    mutationFn: (password: string) =>
      authService.regenerateRecoveryCodes(password),
    onSuccess: () => notify.success('New recovery codes generated'),
    onError: (error) =>
      notify.error('Could not regenerate recovery codes', {
        description: error.message,
      }),
  });
}
