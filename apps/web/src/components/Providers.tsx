'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import { buildTheme } from '../theme/theme';
import { api, tokenStore, type AuthUser } from '../lib/api';

/**
 * Application-wide context: colour mode, session and toast notifications.
 * Consolidating them in one provider keeps `layout.tsx` clean and gives every
 * page the same hooks (`useSession`, `useToast`, `useColorMode`).
 */

interface AppContextValue {
  mode: 'light' | 'dark';
  toggleMode: () => void;
  user: AuthUser | null;
  /** False until the stored session has been read from localStorage. */
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; name: string }) => Promise<void>;
  logout: () => void;
  notify: (message: string, severity?: 'success' | 'error' | 'info' | 'warning') => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside <Providers>');
  return context;
};

export function Providers({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' | 'info' | 'warning' } | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('community-space-mode');
    if (stored === 'dark' || stored === 'light') setMode(stored);
    setUser(tokenStore.user());
    setReady(true);
  }, []);

  const theme = useMemo(() => buildTheme(mode), [mode]);

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const next = current === 'light' ? 'dark' : 'light';
      localStorage.setItem('community-space-mode', next);
      return next;
    });
  }, []);

  const notify = useCallback((message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setToast({ message, severity });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await api.auth.login(email, password);
      tokenStore.set(result.token, result.user);
      setUser(result.user);
      notify(`Welcome back, ${result.user.name.split(' ')[0]}!`, 'success');
    },
    [notify],
  );

  const register = useCallback(
    async (data: { email: string; password: string; name: string }) => {
      const result = await api.auth.register(data);
      tokenStore.set(result.token, result.user);
      setUser(result.user);
      notify('Account created. Complete your profile to get better recommendations.', 'success');
    },
    [notify],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    notify('Signed out', 'info');
  }, [notify]);

  const value = useMemo(
    () => ({ mode, toggleMode, user, ready, login, register, logout, notify }),
    [mode, toggleMode, user, ready, login, register, logout, notify],
  );

  return (
    <AppRouterCacheProvider options={{ key: 'css' }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AppContext.Provider value={value}>
          {children}
          <Snackbar
            open={Boolean(toast)}
            autoHideDuration={4000}
            onClose={() => setToast(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert severity={toast?.severity ?? 'info'} variant="filled" onClose={() => setToast(null)}>
              {toast?.message}
            </Alert>
          </Snackbar>
        </AppContext.Provider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
