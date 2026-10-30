import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export interface ThemeStoreState {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = 'targum-theme';

function getInitialTheme(): Theme {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    }
  } catch {
    // localStorage not accessible
  }
  return 'system';
}

function getSystemTheme(): ResolvedTheme {
  try {
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
  } catch {
    // matchMedia not accessible
  }
  return 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === 'system' ? getSystemTheme() : theme;
}

function applyThemeToDocument(resolved: ResolvedTheme): void {
  if (typeof document !== 'undefined' && document.documentElement) {
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
}

const initialTheme = getInitialTheme();
const initialResolved = resolveTheme(initialTheme);
applyThemeToDocument(initialResolved);

let currentMql: MediaQueryList | null = null;
let currentHandler: ((e: { matches: boolean } | MediaQueryListEvent) => void) | null = null;

function setupMediaListener(
  set: (state: Partial<ThemeStoreState>) => void,
  get: () => ThemeStoreState
): void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return;
  }
  try {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    if (mql === currentMql) {
      return;
    }
    if (currentMql && currentHandler) {
      if (currentMql.removeEventListener) {
        currentMql.removeEventListener('change', currentHandler);
      } else if (currentMql.removeListener) {
        currentMql.removeListener(currentHandler);
      }
    }

    currentMql = mql;
    currentHandler = (e: { matches: boolean } | MediaQueryListEvent) => {
      const current = get();
      if (current.theme === 'system') {
        const resolved: ResolvedTheme = e.matches ? 'dark' : 'light';
        applyThemeToDocument(resolved);
        set({ resolvedTheme: resolved });
      }
    };

    if (mql.addEventListener) {
      mql.addEventListener('change', currentHandler);
    } else if (mql.addListener) {
      mql.addListener(currentHandler);
    }
  } catch {
    // matchMedia not accessible
  }
}

export const useThemeStore = create<ThemeStoreState>((set, get) => {
  setupMediaListener(set, get);

  return {
    theme: initialTheme,
    resolvedTheme: initialResolved,
    setTheme: (theme: Theme) => {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(STORAGE_KEY, theme);
        }
      } catch {
        // localStorage not accessible
      }

      if (theme === 'system') {
        setupMediaListener(set, get);
      }

      const resolved = resolveTheme(theme);
      applyThemeToDocument(resolved);
      set({ theme, resolvedTheme: resolved });
    },
  };
});
