// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useThemeStore } from '../src/state/themeStore';

describe('themeStore', () => {
  let matchMediaListeners: Array<(e: { matches: boolean }) => void> = [];
  let prefersDark = false;

  beforeEach(() => {
    matchMediaListeners = [];
    prefersDark = false;
    useThemeStore.getState().setTheme('light');

    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: prefersDark,
      media: query,
      onchange: null,
      addListener: (fn: (e: { matches: boolean }) => void) => matchMediaListeners.push(fn),
      removeListener: () => {},
      addEventListener: (event: string, fn: (e: { matches: boolean }) => void) => {
        if (event === 'change') matchMediaListeners.push(fn);
      },
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }));
  });

  it('sets light and dark themes and updates DOM and localStorage', () => {
    useThemeStore.getState().setTheme('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('show-converter-theme')).toBe('dark');

    useThemeStore.getState().setTheme('light');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('show-converter-theme')).toBe('light');
  });

  it('resolves system theme based on matchMedia', () => {
    prefersDark = true;
    useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().theme).toBe('system');
    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    prefersDark = false;
    useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('reacts to system color scheme changes when theme is system', () => {
    prefersDark = false;
    useThemeStore.getState().setTheme('system');
    expect(useThemeStore.getState().resolvedTheme).toBe('light');

    // Trigger media query change event
    for (const listener of matchMediaListeners) {
      listener({ matches: true });
    }

    expect(useThemeStore.getState().resolvedTheme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
