// store/auth.ts — Zustand auth store
// Single source of truth for auth state across the app.
// Hydrates from AsyncStorage on boot, writes back on login/logout.

import { create } from 'zustand';
import {
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
  login as authLogin,
  logout as authLogout,
  AuthUser,
} from '@/lib/auth';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;   // true during initial hydration
  isLoggingIn: boolean; // true during login network call

  // Actions
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isLoggingIn: false,

  hydrate: async () => {
    try {
      const stored = await getStoredAuth();
      set({ user: stored, isLoading: false });
    } catch {
      set({ user: null, isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoggingIn: true });
    try {
      const user = await authLogin(email, password);
      set({ user, isLoggingIn: false });
    } catch (err) {
      set({ isLoggingIn: false });
      throw err;
    }
  },

  logout: async () => {
    await authLogout();
    set({ user: null });
  },

  setUser: (user) => set({ user }),
}));

// Convenience selectors
export const selectUser   = (s: AuthState) => s.user;
export const selectPlan   = (s: AuthState) => s.user?.plan ?? 'free';
export const selectIsAuth = (s: AuthState) => s.user !== null;

export const isPaidPlan = (plan?: string) =>
  plan === 'starter' || plan === 'investor' || plan === 'pro' || plan === 'institutional';
