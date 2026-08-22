const isMac = navigator.platform.toUpperCase().includes('MAC');

export type Modifier = 'ctrl' | 'alt' | 'shift' | 'mod';

export interface ParsedShortcut {
  modifiers: Modifier[];
  key: string;
}

// Mac: ⌃⌥⇧⌘, Windows/Linux: Ctrl+Alt+Shift — same order VS Code uses on both platforms.
const MODIFIER_ORDER: Modifier[] = ['ctrl', 'alt', 'shift', 'mod'];

const MAC_SYMBOL: Record<Modifier, string> = { ctrl: '⌃', alt: '⌥', shift: '⇧', mod: '⌘' };
const WIN_LABEL: Record<Modifier, string> = {
  ctrl: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  mod: 'Ctrl'
};

// Keyed by Electron's actual accelerator key names (lowercased) -- "return",
// not "enter" -- so real accelerator strings (e.g. from the keybindings
// registry) and hand-authored menu hints (e.g. `shortcut="delete"`) format
// the same way.
const MAC_KEY_LABEL: Record<string, string> = {
  delete: '⌫',
  return: '⏎',
  esc: 'Esc',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→'
};

const WIN_KEY_LABEL: Record<string, string> = {
  delete: 'Del',
  return: 'Enter',
  esc: 'Esc',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→'
};

// "mod" means "the primary modifier" (⌘ on Mac, Ctrl elsewhere) — the one nearly
// every shortcut needs. `ctrl` stays literal since it's a distinct physical key
// on Mac (⌃) from `mod` (⌘), unlike on Windows/Linux where they're the same key.
//
// Two vocabularies feed this: hand-authored menu hints use the shorthand
// tokens themselves ("mod+c", "ctrl+shift+r" -- see ContextMenu.tsx), while
// keybindings store real Electron accelerator strings ("CommandOrControl+Shift+R" --
// see src/renderer/src/lib/keybindings.ts). Map every spelling either
// vocabulary uses onto the same four buckets.
const MODIFIER_TOKEN: Record<string, Modifier> = {
  mod: 'mod',
  commandorcontrol: 'mod',
  cmdorctrl: 'mod',
  command: 'mod',
  cmd: 'mod',
  super: 'mod',
  meta: 'mod',
  ctrl: 'ctrl',
  control: 'ctrl',
  alt: 'alt',
  option: 'alt',
  altgr: 'alt',
  shift: 'shift'
};

export function parseShortcut(shortcut: string): ParsedShortcut {
  const tokens = shortcut.toLowerCase().split('+');
  const key = tokens.pop()!;
  const found = new Set(tokens.map((t) => MODIFIER_TOKEN[t]).filter(Boolean));
  const modifiers = MODIFIER_ORDER.filter((m) => found.has(m));
  return { modifiers, key };
}

export function formatShortcut(shortcut: string): string {
  const { modifiers, key } = parseShortcut(shortcut);
  const keyLabel = (isMac ? MAC_KEY_LABEL : WIN_KEY_LABEL)[key] ?? key.toUpperCase();

  return isMac
    ? modifiers.map((m) => MAC_SYMBOL[m]).join('') + keyLabel
    : [...modifiers.map((m) => WIN_LABEL[m]), keyLabel].join('+');
}
