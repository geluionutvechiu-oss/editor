import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../services/api';

interface User {
  id: number;
  username: string;
  email?: string;
  role: 'admin' | 'reseller' | 'user';
  exp_date?: string;
  max_connections: number;
  active_connections?: number;
  bouquet_id?: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true });
        try {
          const response = await authApi.login(username, password) as any;
          const { token, user } = response;
          localStorage.setItem('iptv_token', token);
          set({ token, user, isAuthenticated: true, isLoading: false });
        } catch (err) {
          set({ isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        try {
          await authApi.logout();
        } catch {}
        localStorage.removeItem('iptv_token');
        localStorage.removeItem('iptv_user');
        set({ token: null, user: null, isAuthenticated: false });
      },

      refreshUser: async () => {
        try {
          const response = await authApi.me() as any;
          set({ user: response.user });
        } catch {}
      },
    }),
    {
      name: 'iptv_auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
