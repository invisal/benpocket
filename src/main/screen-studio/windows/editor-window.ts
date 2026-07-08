import type { BrowserWindow } from 'electron';

// The editor currently shares the main window (see main-window.ts) via
// client-side routing. This module is reserved for a future dedicated
// editor window (e.g. multi-window editing of several recordings at once).
// TODO: implement multi-window project editing
export function focusOrCreateEditorWindow(): BrowserWindow | null {
  return null;
}
