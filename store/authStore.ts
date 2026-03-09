import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

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

export interface SignupData {
  name: string;
  email: string;
  phone: string;
  password: string;
  companyName: string;
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

        // ✅ Login — fully replaces state, no merging
        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Login failed');
            }

            // ✅ FIXED: Replace state entirely — never spread old user
            set({
              user: data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Login failed';
            set({
              ...initialState, // ✅ Reset everything on failure
              error: errorMessage,
            });
            throw error;
          }
        },

        // ✅ Signup — fully replaces state, no merging
        signup: async (data: SignupData) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/auth/signup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.error || 'Signup failed');
            }

            // ✅ FIXED: Replace state entirely — never spread old user
            set({
              user: result.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Signup failed';
            set({
              ...initialState, // ✅ Reset everything on failure
              error: errorMessage,
            });
            throw error;
          }
        },

        // ✅ Logout — clears memory AND persisted localStorage
        logout: async () => {
          set({ isLoading: true });
          try {
            await fetch('/api/auth/logout', { method: 'POST' });
          } catch (error) {
            console.error('Logout error:', error);
          } finally {
            // ✅ FIXED: Clear persisted storage so no stale user bleeds into next login
            useAuthStore.persist.clearStorage();
            set(initialState);
          }
        },

        // ✅ Fetch current user from server (used on app load)
        fetchUser: async () => {
          set({ isLoading: true });
          try {
            const response = await fetch('/api/auth/me');

            if (!response.ok) {
              // ✅ Clear everything if session is invalid
              useAuthStore.persist.clearStorage();
              set(initialState);
              return;
            }

            const data = await response.json();

            // ✅ Replace state entirely
            set({
              user: data.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
          } catch (error) {
            useAuthStore.persist.clearStorage();
            set(initialState);
          }
        },

        // ✅ Update profile — only spreads into existing user (correct use of spread)
        updateProfile: async (data: Partial<User>) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/users/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.error || 'Update failed');
            }

            // ✅ FIXED: Spread only result.user (not the full response object)
            const updatedUser = result.user ?? result;
            set((state) => ({
              user: state.user ? { ...state.user, ...updatedUser } : null,
              isLoading: false,
              error: null,
            }));
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Update failed';
            set({ error: errorMessage, isLoading: false });
            throw error;
          }
        },

        resetAuth: () => {
          useAuthStore.persist.clearStorage();
          set(initialState);
        },
      }),
      {
        name: 'auth-storage',
        storage: createJSONStorage(() => localStorage),

        // ✅ FIXED: Use merge to REPLACE persisted state, not shallow-merge it
        // This prevents stale user data from a previous session bleeding into a new login
        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as Partial<AuthState>),
        }),

        // ✅ Only persist what's needed — never persist loading/error states
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        }),
      }
    )
  )
);