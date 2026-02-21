import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'superadmin' | 'admin' | 'user';
  companyId: string;
  profilePhoto?: string;
  company?: {
    companyName: string;
    logo?: string;
    subscriptionType: string;
    subscriptionExpiry: string;
  };
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: SignupData) => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  resetAuth: () => void;
}

export interface SignupData {
  name: string;
  email: string;
  phone: string;
  password: string;
  companyName: string;
}

const initialState = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setUser: (user) => set({ user, isAuthenticated: !!user }),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error }),

        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });

            if (!response.ok) {
              throw new Error('Invalid credentials');
            }

            const data = await response.json();
            set({
              user: data.user,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            set({
              error: errorMessage,
              isLoading: false,
              isAuthenticated: false,
            });
            throw error;
          }
        },

        signup: async (data: SignupData) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw new Error('Signup failed');
            }

            const result = await response.json();
            set({
              user: result.user,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Signup failed';
            set({
              error: errorMessage,
              isLoading: false,
              isAuthenticated: false,
            });
            throw error;
          }
        },

        logout: async () => {
          set({ isLoading: true });
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
            set(initialState);
          } catch (error) {
            console.error('Logout error:', error);
            set(initialState);
          }
        },

        fetchUser: async () => {
          set({ isLoading: true });
          try {
            const response = await fetch('/api/auth/me');

            if (!response.ok) {
              set(initialState);
              return;
            }

            const data = await response.json();
            set({
              user: data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            set(initialState);
          }
        },

        updateProfile: async (data: Partial<User>) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/users/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });

            if (!response.ok) {
              throw new Error('Update failed');
            }

            const updated = await response.json();
            set((state) => ({
              user: state.user ? { ...state.user, ...updated } : null,
              isLoading: false,
            }));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Update failed';
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        resetAuth: () => set(initialState),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
);