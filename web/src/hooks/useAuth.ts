import { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '../types';
import { getMe, logout as apiLogout, updateProfile } from '../api';

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
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
        const { detectBrowserTimezone } = await import('../utils/timezone');
        const detected = detectBrowserTimezone();
        if (detected && detected !== 'UTC') {
          try {
            const updated = await updateProfile({ timezone: detected } as Partial<User>);
            setState({ user: updated, loading: false, error: null });
          } catch { /* ignore — not critical */ }
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

  return {
    user: state.user,
    loading: state.loading,
    error: state.error,
    isAuthenticated: !!state.user,
    logout,
    refresh: checkAuth,
  };
}
