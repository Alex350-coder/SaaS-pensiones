import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { initTheme, useThemeStore } from './theme-store';

/** Controllable matchMedia so we can flip the OS preference and fire `change`. */
function stubMatchMedia(prefersDark: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = [];
  const mql = {
    matches: prefersDark,
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as never;
  return { fireChange: () => listeners.forEach((cb) => cb({} as MediaQueryListEvent)) };
}

describe('theme-store', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="" />';
    document.documentElement.classList.remove('dark');
    stubMatchMedia(false);
    useThemeStore.setState({ mode: 'system', resolved: 'light' });
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  const metaColor = () =>
    document.querySelector('meta[name="theme-color"]')!.getAttribute('content');

  it('setMode("dark") applies the dark class and browser color', () => {
    useThemeStore.getState().setMode('dark');
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(metaColor()).toBe('#14242a');
  });

  it('setMode("light") removes the dark class', () => {
    useThemeStore.getState().setMode('dark');
    useThemeStore.getState().setMode('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(metaColor()).toBe('#40798c');
  });

  it('setMode("system") resolves from the OS preference', () => {
    stubMatchMedia(true);
    useThemeStore.getState().setMode('system');
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('toggle flips resolved theme and pins the mode', () => {
    useThemeStore.setState({ mode: 'system', resolved: 'light' });
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().resolved).toBe('dark');
    expect(useThemeStore.getState().mode).toBe('dark');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().resolved).toBe('light');
  });

  it('initTheme applies the current mode and tracks OS changes in system mode', () => {
    const media = stubMatchMedia(true);
    useThemeStore.setState({ mode: 'system', resolved: 'light' });
    initTheme();
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // A live OS change while in system mode updates the resolved theme.
    useThemeStore.setState({ mode: 'system' });
    media.fireChange();
    expect(useThemeStore.getState().resolved).toBe('dark');
  });

  it('initTheme ignores OS changes when the user pinned a mode', () => {
    const media = stubMatchMedia(true);
    initTheme();
    useThemeStore.setState({ mode: 'light', resolved: 'light' });
    media.fireChange();
    expect(useThemeStore.getState().resolved).toBe('light');
  });
});
