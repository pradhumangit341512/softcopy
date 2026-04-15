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
  user:            User | null;
  isLoading:       boolean;
  isAuthenticated: boolean;
  hasFetched:      boolean;   // ✅ prevents infinite fetchUser loop
  error:           string | null;

  // Actions
  setUser:       (user: User | null) => void;
  setLoading:    (loading: boolean) => void;
  setError:      (error: string | null) => void;
  login:         (email: string, password: string) => Promise<{ requireOTP: boolean; message?: string }>;
  signup:        (data: SignupData) => Promise<{ requireOTP: boolean; message?: string }>;
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

        // ── Login Step 1: validate creds → returns requireOTP: true
        // ── Login Step 2: handled directly in LoginPage with otp param
        login: async (email: string, password: string) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/auth/login', {
              method:      'POST',
              headers:     { 'Content-Type': 'application/json' },
              credentials: 'include',
              body:        JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
              throw new Error(data.error || 'Login failed');
            }

            // OTP required — not an error (only trust this on 2xx responses)
            if (data.requireOTP) {
              set({ isLoading: false });
              return { requireOTP: true, message: data.message };
            }

            // Direct login success (no OTP) — set user
            set({
              user:            data.user,
              isAuthenticated: true,
              hasFetched:      true,
              isLoading:       false,
              error:           null,
            });
            return { requireOTP: false };
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Login failed';
            set({ ...initialState, error: msg });
            return { requireOTP: false, message: msg };
          }
        },

        // ── Signup Step 1: validate + send OTP → returns requireOTP: true
        // ── Signup Step 2: handled directly in SignupPage with otp param
        signup: async (data: SignupData) => {
          set({ isLoading: true, error: null });
          try {
            const response = await fetch('/api/auth/signup', {
              method:      'POST',
              headers:     { 'Content-Type': 'application/json' },
              credentials: 'include',
              body:        JSON.stringify(data),
            });

            const result = await response.json();

            if (!response.ok) {
              throw new Error(result.error || 'Signup failed');
            }

            // OTP required — not an error (only trust this on 2xx responses)
            if (result.requireOTP) {
              set({ isLoading: false });
              return { requireOTP: true, message: result.message };
            }

            // Direct signup success (no OTP) — set user
            set({
              user:            result.user,
              isAuthenticated: true,
              hasFetched:      true,
              isLoading:       false,
              error:           null,
            });
            return { requireOTP: false };
          } catch (error) {
            const msg = error instanceof Error ? error.message : 'Signup failed';
            set({ ...initialState, error: msg });
            return { requireOTP: false, message: msg };
          }
        },

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

          set({ isLoading: true, hasFetched: true });
          try {
            const response = await fetch('/api/auth/me', {
              credentials: 'include',
              cache:       'no-store',
            });

            if (!response.ok) {
              // 401 = not logged in or token expired — clear stale state
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

        // 🔐 Never persist the user object (role, companyId, email) to
        // localStorage — XSS can exfiltrate it. Only persist a lightweight
        // "was authenticated" hint so the UI can show the right shell while
        // /api/auth/me is re-verified on mount.
        partialize: (state) => ({
          isAuthenticated: state.isAuthenticated,
        }),

        merge: (persistedState, currentState) => ({
          ...currentState,
          ...(persistedState as Partial<AuthState>),
          // Always reset — user is re-fetched from the server on rehydrate
          user:       null,
          isLoading:  false,
          hasFetched: false,
          error:      null,
        }),
      }
    )
  )
);