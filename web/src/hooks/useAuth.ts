import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react';
import type { User } from '../types';
import { getMe, logout as apiLogout, updateProfile } from '../api';
import { detectBrowserTimezone } from '../utils/timezone';

interface AuthState {
  user: User | null;
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuthProvider(): AuthContextValue {
  const [state, setState] = useState<AuthState>({
    user: null,
    loading: true,
  });
  const tzSynced = useRef(false);

  const checkAuth = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const user = await getMe();
      setState({ user, loading: false });

      // Auto-detect timezone on first login (when still default "UTC")
      if (!tzSynced.current && user.timezone === 'UTC') {
        tzSynced.current = true;
        const detected = detectBrowserTimezone();
        if (detected && detected !== 'UTC') {
          try {
            const updated = await updateProfile({ timezone: detected });
            setState({ user: updated, loading: false });
          } catch {
            /* ignore — not critical */
          }
        }
      }
    } catch {
      setState({ user: null, loading: false });
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
    setState({ user: null, loading: false });
  }, []);

  const setUser = useCallback((user: User) => {
    setState({ user, loading: false });
  }, []);

  return {
    user: state.user,
    loading: state.loading,
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
