import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  authService,
  type Credentials,
  type RegisterPayload,
} from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { notify } from '@/lib/toast';

export function useAuth() {
  const { user, setSession, clearSession } = useAuthStore();
  return {
    user,
    isAuthenticated: Boolean(user),
    setSession,
    clearSession,
  };
}

export function useLogin() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (payload: Credentials) => authService.login(payload),
    onSuccess: ({ user, token }) => {
      setSession(user, token);
      notify.success(`Welcome back, ${user.name}`);
      navigate('/');
    },
    onError: (error) =>
      notify.error('Login failed', { description: error.message }),
  });
}

export function useRegister() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  return useMutation({
    mutationFn: (payload: RegisterPayload) => authService.register(payload),
    onSuccess: ({ user, token }) => {
      setSession(user, token);
      notify.success('Admin account created');
      navigate('/');
    },
    onError: (error) =>
      notify.error('Setup failed', { description: error.message }),
  });
}
