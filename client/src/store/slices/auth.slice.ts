import type { StateCreator } from 'zustand';
import type { User } from '../types';
import { API_BASE, authFetch } from '../utils';
import { notifications } from '@mantine/notifications';
import { translations } from '../../i18n';

export interface AuthSlice {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  language: 'en' | 'de';
  
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  changePassword: (current: string, newP: string) => Promise<void>;
  logout: () => void;
  toggleLanguage: () => void;
}

export const createAuthSlice: StateCreator<any, [], [], AuthSlice> = (set, get) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  language: 'en',

  toggleLanguage: () => {
      set((state: any) => ({ language: state.language === 'en' ? 'de' : 'en' }));
  },

  login: async (username, password) => {
      set({ isLoading: true, error: null });
      try {
          const res = await fetch(`${API_BASE}/api/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Login failed');
          
          set({ token: data.token, user: data.user, isAuthenticated: true, isLoading: false });
          await get().init();
      } catch (e: any) {
          set({ error: e.message, isLoading: false });
      }
  },

  register: async (username, password) => {
      set({ isLoading: true, error: null });
      try {
          const res = await fetch(`${API_BASE}/api/register`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Registration failed');
          set({ isLoading: false, error: null });
          
          const lang = get().language as keyof typeof translations;
          notifications.show({
              title: translations[lang].registerSuccess,
              message: '',
              color: 'green'
          });
      } catch (e: any) {
          set({ error: e.message, isLoading: false });
      }
  },

  changePassword: async (current, newP) => {
      set({ isLoading: true, error: null });
      try {
          const res = await authFetch(`${API_BASE}/api/user/password`, get().token, {
              method: 'POST',
              body: JSON.stringify({ currentPassword: current, newPassword: newP })
          });
          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || 'Password change failed');
          }
          set({ isLoading: false, error: null });
          
          const lang = get().language as keyof typeof translations;
          notifications.show({
              title: translations[lang].update || 'Updated',
              message: translations[lang].password || 'Password changed',
              color: 'green'
          });
      } catch (e: any) {
          set({ error: e.message, isLoading: false });
          throw e;
      }
  },

  logout: () => {
      set({ 
        token: null, user: null, isAuthenticated: false, files: [], scopes: [], 
        tags: [], selectedFileIds: [], shares: [], privacyProfiles: [] 
      });
  },
});
