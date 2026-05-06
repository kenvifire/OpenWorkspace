'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/auth';
import { usersApi } from '@/lib/api';

interface ThemeContextValue {
  theme: string;
  setTheme: (t: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const VALID_THEMES = ['dark-purple', 'light', 'dark-ocean', 'midnight'] as const;

export function ThemeProvider({ children, initialTheme }: { children: ReactNode; initialTheme: string }) {
  const [theme, setThemeState] = useState(initialTheme);
  const { getToken } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const setTheme = (t: string) => {
    document.documentElement.dataset.theme = t;
    // Sync cookie so flash-prevention script picks it up on next hard refresh
    document.cookie = `theme=${t}; path=/; SameSite=Lax`;
    setThemeState(t);
    getTokenRef.current().then((token) => {
      if (!token) return;
      usersApi.updateTheme(t);
    });
  };

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}
