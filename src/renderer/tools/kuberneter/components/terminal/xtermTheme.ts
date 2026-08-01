import type { ITheme } from '@xterm/xterm';

/**
 * Reads a CSS custom property off :root, falling back to a literal so the
 * terminal still themes correctly before Tailwind's layer resolves.
 */
function cssVar(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

/**
 * Builds an xterm ITheme from the app's Catppuccin tokens. The 16 ANSI colors
 * are pinned to Catppuccin Mocha/Latte so program output (kubectl, ls, git)
 * reads correctly; the surface/foreground/cursor pull from live CSS vars so
 * the terminal tracks the active light/dark theme.
 */
export function buildXtermTheme(): ITheme {
  const isLight =
    typeof document !== 'undefined' && document.documentElement.classList.contains('light');

  // Catppuccin ANSI palette (Mocha for dark, Latte for light).
  const ansi = isLight
    ? {
        black: '#5c5f77',
        red: '#d20f39',
        green: '#40a02b',
        yellow: '#df8e1d',
        blue: '#1e66f5',
        magenta: '#ea76cb',
        cyan: '#179299',
        white: '#acb0be',
        brightBlack: '#6c6f85',
        brightRed: '#d20f39',
        brightGreen: '#40a02b',
        brightYellow: '#df8e1d',
        brightBlue: '#1e66f5',
        brightMagenta: '#ea76cb',
        brightCyan: '#179299',
        brightWhite: '#bcc0cc'
      }
    : {
        black: '#45475a',
        red: '#f38ba8',
        green: '#a6e3a1',
        yellow: '#f9e2af',
        blue: '#89b4fa',
        magenta: '#f5c2e7',
        cyan: '#94e2d5',
        white: '#bac2de',
        brightBlack: '#585b70',
        brightRed: '#f38ba8',
        brightGreen: '#a6e3a1',
        brightYellow: '#f9e2af',
        brightBlue: '#89b4fa',
        brightMagenta: '#f5c2e7',
        brightCyan: '#94e2d5',
        brightWhite: '#a6adc8'
      };

  return {
    background: cssVar('--color-surface', isLight ? '#ffffff' : '#1e1e1e'),
    foreground: cssVar('--color-foreground', isLight ? '#5c5f7a' : '#c0c5d8'),
    cursor: cssVar('--color-accent', isLight ? '#1e66f5' : '#89b4fa'),
    cursorAccent: cssVar('--color-surface', isLight ? '#ffffff' : '#1e1e1e'),
    selectionBackground: isLight ? 'rgba(30,102,245,0.20)' : 'rgba(137,180,250,0.30)',
    ...ansi
  };
}
