import { create } from 'zustand';
import type { AuthUser } from '@/interfaces';

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearSession: () => set({ user: null }),
}));
