import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const getSystemTheme = (): Theme =>
  window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: getSystemTheme(),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' }))
    }),
    { name: 'craftbox-theme' }
  )
);

/** Dark is the unclassed default; `.light` on <html> switches tokens (see main.css). */
export function useSyncDocumentTheme(): void {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
  }, [theme]);
}
