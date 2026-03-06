import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import type { User } from '../types';
import { getMe, logout as apiLogout, updateProfile } from '../api';
import { detectBrowserTimezone } from '../utils/timezone';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export { AuthContext };

export function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
    error: null,
  });
  const tzSynced = useRef(false);

  const checkAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const user = await getMe();
      setState({ user, loading: false, error: null });

      // Auto-detect timezone on first login (when still default "UTC")
      if (!tzSynced.current && user.timezone === 'UTC') {
        tzSynced.current = true;
        const detected = detectBrowserTimezone();
        if (detected && detected !== 'UTC') {
          try {
            const updated = await updateProfile({ timezone: detected } as Partial<User>);
            setState({ user: updated, loading: false, error: null });
          } catch {
            /* ignore — not critical */
          }
        }
      }
    } catch {
      setState({ user: null, loading: false, error: null });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Ignore logout errors
    }
    setState({ user: null, loading: false, error: null });
  }, []);

  const setUser = useCallback((user: User) => {
    setState({ user, loading: false, error: null });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    logout,
    refresh: checkAuth,
    setUser,
  };
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
