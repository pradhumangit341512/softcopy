import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';

// ─────────────────────────────────────────
// Types
// ─────────────────────────────────────────
export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'superadmin' | 'admin' | 'user';
  companyId: string | null;
  profilePhoto?: string;
  company?: {
    companyName: string;
    logo?: string;
    subscriptionType: string;
    subscriptionExpiry: string;
  };
}

export interface AuthState {
  user:            User | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  hasFetched:      boolean;   // ✅ prevents infinite fetchUser loop
  error:           string | null;

  // Actions
  setUser:       (user: User | null) => void;
  setLoading:    (loading: boolean) => void;
  setError:      (error: string | null) => void;
  logout:        () => Promise<void>;
  fetchUser:     () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  resetAuth:     () => void;
}

// ─────────────────────────────────────────
// Initial state
// ─────────────────────────────────────────
const initialState = {
  user:            null,
  isLoading:       false,
  isAuthenticated: false,
  hasFetched:      false,
  error:           null,
};

// ─────────────────────────────────────────
// Store
// ─────────────────────────────────────────
export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ✅ setUser — called after OTP verify, sets all flags correctly
        setUser: (user: User | null) => set({
          user,
          isAuthenticated: !!user,
          hasFetched:      true,
          isLoading:       false,
          error:           null,
        }),

        setLoading: (isLoading) => set({ isLoading }),

        setError: (error) => set({ error }),

        // ── Logout ──
        logout: async () => {
          set({ isLoading: true });
          try {
            await fetch('/api/auth/logout', {
              method:      'POST',
              credentials: 'include',
            });
          } catch (error) {
            console.error('Logout error:', error);
          } finally {
            useAuthStore.persist.clearStorage();
            set(initialState);
          }
        },

        // ── Fetch user on app load — runs once via hasFetched guard in useAuth ──
        fetchUser: async () => {
          if (get().hasFetched || get().isLoading) return;

          set({ isLoading: true });
          try {
            const response = await fetch('/api/auth/me', {
              credentials: 'include',
              cache:       'no-store',
            });

            if (!response.ok) {
              // Detect if another device kicked us out
              try {
                const body = await response.json();
                if (body?.code === 'AUTH_SESSION_REPLACED') {
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('session_replaced', '1');
                  }
                }
              } catch {}
              useAuthStore.persist.clearStorage();
              set({ ...initialState, hasFetched: true });
              return;
            }

            const data = await response.json();
            set({
              user:            data.user,
              isAuthenticated: true,
              hasFetched:      true,
              isLoading:       false,
              error:           null,
            });
          } catch {
            set({ ...initialState, hasFetched: true });
          }
        },

        // ── Update profile ──
        updateProfile: async (data: Partial<User>) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/users/profile', {
              method:      'PUT',
              headers:     { 'Content-Type': 'application/json' },
              credentials: 'include',
              body:        JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.error || 'Update failed');
            }

            const updatedUser = result.user ?? result;
            set((state) => ({
              user:      state.user ? { ...state.user, ...updatedUser } : null,
              isLoading: false,
              error:     null,
            }));
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Update failed';
            set({ error: msg, isLoading: false });
          }
        },

        // ── Reset ──
        resetAuth: () => {
          useAuthStore.persist.clearStorage();
          set(initialState);
        },
      }),

      {
        name:    'auth-storage',
        storage: createJSONStorage(() => localStorage),

        // 🔐 Persist NOTHING. The cookie is the only source of truth.
        // - No user object → XSS can't exfiltrate PII
        // - No isAuthenticated flag → no "ghost" auth state that lingers after
        //   the cookie has expired (which causes redirect loops like
        //   `/` → `/dashboard` → `/login`)
        // Every page load re-verifies via /api/auth/me.
        partialize: () => ({}),

        merge: (_persistedState, currentState) => ({
          ...currentState,
          user:            null,
          isAuthenticated: false,
          isLoading:       false,
          hasFetched:      false,
          error:           null,
        }),
      }
    )
  )
);