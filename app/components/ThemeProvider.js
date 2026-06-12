'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { applyBranding, getBranding } from '@/app/branding';

const ThemeContext = createContext({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  branding: null,
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemTheme() {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('system');
  const [resolvedTheme, setResolvedTheme] = useState('light');
  const [branding, setBranding] = useState(null);
  const [mounted, setMounted] = useState(false);

  const applyTheme = useCallback((themeValue) => {
    const resolved = themeValue === 'system' ? getSystemTheme() : themeValue;
    setResolvedTheme(resolved);

    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', resolved);
    }
  }, []);

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('nb-theme', newTheme);
    }
  }, [applyTheme]);

  // Initialize on mount
  useEffect(() => {
    // Load saved theme
    const saved = localStorage.getItem('nb-theme') || 'system';
    setThemeState(saved);
    applyTheme(saved);

    // Load branding
    const brandingConfig = getBranding();
    setBranding(brandingConfig);
    applyBranding(brandingConfig);

    setMounted(true);

    // Listen for system theme changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const current = localStorage.getItem('nb-theme') || 'system';
      if (current === 'system') {
        applyTheme('system');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [applyTheme]);

  // Prevent flash of wrong theme
  if (!mounted) {
    return (
      <div style={{ visibility: 'hidden' }}>
        {children}
      </div>
    );
  }

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, branding }}>
      {children}
    </ThemeContext.Provider>
  );
}
