import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  authService,
  type Credentials,
  type MfaVerifyPayload,
  type RegisterPayload,
} from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { notify } from '@/lib/toast';

export function useAuth() {
  const { user, setUser, clearSession } = useAuthStore();
  return {
    user,
    isAuthenticated: Boolean(user),
    setUser,
    clearSession,
  };
}

export function useSession() {
  const setUser = useAuthStore((s) => s.setUser);
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const user = await authService.me();
      setUser(user);
      return user;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSetupState(enabled = true) {
  return useQuery({
    queryKey: ['auth', 'setup-state'],
    queryFn: () => authService.needsSetup(),
    enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useLogin() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (payload: Credentials) => authService.login(payload),
    onSuccess: (result) => {
      if ('mfaRequired' in result) return;
      setUser(result.user);
      qc.setQueryData(['auth', 'me'], result.user);
      notify.success(`Welcome back, ${result.user.name}`);
      navigate('/');
    },
    onError: (error) =>
      notify.error('Login failed', { description: error.message }),
  });
}

export function useVerifyMfa() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (payload: MfaVerifyPayload) => authService.verifyMfa(payload),
    onSuccess: ({ user }) => {
      setUser(user);
      qc.setQueryData(['auth', 'me'], user);
      notify.success(`Welcome back, ${user.name}`);
      navigate('/');
    },
    onError: (error) =>
      notify.error('Verification failed', { description: error.message }),
  });
}

export function useRegister() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: ({ user }) => {
      setUser(user);
      qc.setQueryData(['auth', 'me'], user);
      notify.success('Admin account created');
      navigate('/');
    },
    onError: (error) =>
      notify.error('Setup failed', { description: error.message }),
  });
}

export function useInvitePreview(token: string | undefined) {
  return useQuery({
    queryKey: ['auth', 'invite-preview', token],
    queryFn: () => authService.previewInvite(token!),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useAcceptInvite() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authService.acceptInvite(token, password),
    onSuccess: ({ user }) => {
      setUser(user);
      qc.setQueryData(['auth', 'me'], user);
      notify.success(`Welcome to Berth, ${user.name}`);
      navigate('/');
    },
    onError: (error) =>
      notify.error('Could not accept invite', { description: error.message }),
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    onError: (error) =>
      notify.error('Could not request password reset', {
        description: error.message,
      }),
  });
}

export function useResetTokenPreview(token: string | undefined) {
  return useQuery({
    queryKey: ['auth', 'reset-preview', token],
    queryFn: () => authService.previewResetToken(token!),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useResetPassword() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: ({ token, password }: { token: string; password: string }) =>
      authService.resetPassword(token, password),
    onSuccess: ({ user }) => {
      setUser(user);
      qc.setQueryData(['auth', 'me'], user);
      notify.success('Password updated');
      navigate('/');
    },
    onError: (error) =>
      notify.error('Could not reset password', { description: error.message }),
  });
}

export function useLogout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clearSession = useAuthStore((s) => s.clearSession);
  return useMutation({
    mutationFn: () => authService.logout(),
    onSettled: () => {
      clearSession();
      qc.clear();
      notify.info('Signed out');
      navigate('/login');
    },
  });
}
