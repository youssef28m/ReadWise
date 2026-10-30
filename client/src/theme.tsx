import { createContext, useCallback, useContext, useLayoutEffect, useState, type ReactNode } from 'react';

export type Theme = 'paper' | 'sepia' | 'night';

const THEME_KEY = 'tapword-theme';
const LEGACY_THEME_KEY = 'tapword-reader-theme';
const LAST_LIGHT_THEME_KEY = 'tapword-last-light-theme';

function isTheme(value: string | null): value is Theme {
  return value === 'paper' || value === 'sepia' || value === 'night';
}

export function readTheme(): Theme {
  if (typeof window === 'undefined') return 'paper';
  const stored = window.localStorage.getItem(THEME_KEY) ?? window.localStorage.getItem(LEGACY_THEME_KEY);
  return isTheme(stored) ? stored : 'paper';
}

export function applyTheme(theme: Theme): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle('dark', theme === 'night');
  root.style.colorScheme = theme === 'night' ? 'dark' : 'light';
}

function readLastLightTheme(): Theme {
  if (typeof window === 'undefined') return 'paper';
  const stored = window.localStorage.getItem(LAST_LIGHT_THEME_KEY);
  return stored === 'sepia' || stored === 'paper' ? stored : 'paper';
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleNight: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme);
  const [lastLightTheme, setLastLightTheme] = useState<Theme>(() => {
    const current = readTheme();
    return current === 'night' ? readLastLightTheme() : current;
  });

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    if (next !== 'night') {
      setLastLightTheme(next);
      window.localStorage.setItem(LAST_LIGHT_THEME_KEY, next);
    }
  }, []);

  const toggleNight = useCallback(() => {
    setTheme(theme === 'night' ? lastLightTheme : 'night');
  }, [lastLightTheme, setTheme, theme]);

  useLayoutEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme, toggleNight }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider.');
  return context;
}
