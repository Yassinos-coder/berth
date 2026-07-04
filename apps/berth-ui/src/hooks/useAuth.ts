import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  authService,
  type Credentials,
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
    onSuccess: ({ user }) => {
      setUser(user);
      qc.setQueryData(['auth', 'me'], user);
      notify.success(`Welcome back, ${user.name}`);
      navigate('/');
    },
    onError: (error) =>
      notify.error('Login failed', { description: error.message }),
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
