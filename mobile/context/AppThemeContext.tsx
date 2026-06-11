import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { ThemeDark, ThemeLight, type ThemeColors } from '@/constants/theme';
import {
  getStoredThemeMode,
  setStoredThemeMode,
  type ThemeMode,
} from '@/lib/theme-preference-storage';

type AppThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
};

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const stored = await getStoredThemeMode();
      if (!cancelled && stored) setMode(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setThemeMode = useCallback((next: ThemeMode) => {
    setMode(next);
    void setStoredThemeMode(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setThemeMode]);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      mode,
      isDark: mode === 'dark',
      colors: mode === 'dark' ? ThemeDark : ThemeLight,
      toggleTheme,
      setThemeMode,
    }),
    [mode, setThemeMode, toggleTheme],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme deve ser usado dentro de AppThemeProvider');
  }
  return ctx;
}
