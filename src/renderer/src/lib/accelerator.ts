const isMac = navigator.platform.toUpperCase().includes('MAC');

const NAMED_CODE_LABEL: Record<string, string> = {
  Space: 'Space',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  Enter: 'Return',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Tab: 'Tab'
};

// Unshifted character each punctuation key produces on a US layout.
const PUNCTUATION_CODE_LABEL: Record<string, string> = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`'
};

const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Alt', 'Shift']);

// Uses `e.code` (the physical key) rather than `e.key` wherever possible --
// `key` reflects the character Shift produces (Shift+5 is "%", Shift+- is
// "_"), which would silently rebind the wrong key whenever Shift is held.
export function normalizeKey(e: KeyboardEvent): string | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  if (e.key === 'Escape') return null; // reserved to cancel the capture UI

  if (NAMED_CODE_LABEL[e.code]) return NAMED_CODE_LABEL[e.code];
  if (/^Digit[0-9]$/.test(e.code)) return e.code.slice(5);
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) return e.code;
  if (PUNCTUATION_CODE_LABEL[e.code]) return PUNCTUATION_CODE_LABEL[e.code];

  // Fallback for anything `code` doesn't map cleanly (e.g. non-US layouts).
  if (e.key.length === 1) return e.key.toUpperCase();
  return null;
}

/**
 * Builds an Electron accelerator string (e.g. "CommandOrControl+Shift+R")
 * from a raw browser KeyboardEvent, for the "press keys to assign a
 * keybinding" capture UI. The inverse of `parseShortcut`/`formatShortcut` in
 * ./shortcut.ts, which render an accelerator string back to display labels.
 *
 * Returns null for a bare modifier press, Escape (reserved to cancel
 * capture), or a key with no modifier held -- global shortcuts need at
 * least one modifier so they don't hijack plain typing.
 */
export function acceleratorFromKeyboardEvent(e: KeyboardEvent): string | null {
  const key = normalizeKey(e);
  if (key === null) return null;

  const modifiers: string[] = [];
  const modPressed = isMac ? e.metaKey : e.ctrlKey;
  if (modPressed) modifiers.push('CommandOrControl');
  // Distinct from the primary "mod" modifier only on Mac, where Control is a
  // separate physical key from Command.
  if (isMac && e.ctrlKey) modifiers.push('Control');
  if (e.altKey) modifiers.push('Alt');
  if (e.shiftKey) modifiers.push('Shift');

  if (modifiers.length === 0) return null;

  return [...modifiers, key].join('+');
}
