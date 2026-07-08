import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  /** The theme actually applied once `system` is resolved. */
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Flip between light and dark from whatever is currently showing. */
  toggle: () => void;
}

const prefersDark = (): boolean =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const resolve = (mode: ThemeMode): ResolvedTheme =>
  mode === 'system' ? (prefersDark() ? 'dark' : 'light') : mode;

/** Apply the resolved theme to <html> and keep the browser UI color in sync. */
function applyTheme(resolved: ResolvedTheme): void {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', resolved === 'dark' ? '#14242a' : '#40798c');
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolved: resolve('system'),
      setMode: (mode) => {
        const resolved = resolve(mode);
        applyTheme(resolved);
        set({ mode, resolved });
      },
      toggle: () => {
        const next: ResolvedTheme = get().resolved === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        set({ mode: next, resolved: next });
      },
    }),
    {
      name: 'pensiones.theme',
      partialize: (state) => ({ mode: state.mode }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const resolved = resolve(state.mode);
        applyTheme(resolved);
        state.resolved = resolved;
      },
    },
  ),
);

/**
 * Wire up initial paint + live OS-preference changes. Called once at startup;
 * safe to call before React renders (avoids a flash of the wrong theme).
 */
export function initTheme(): void {
  const { mode } = useThemeStore.getState();
  applyTheme(resolve(mode));

  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (useThemeStore.getState().mode !== 'system') return;
      const resolved = resolve('system');
      applyTheme(resolved);
      useThemeStore.setState({ resolved });
    });
}
