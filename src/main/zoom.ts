import type { BrowserWindow, WebContents } from 'electron';

// Electron's zoomLevel maps to zoomFactor via 1.2^level (same curve Chrome
// uses), so +/-8 covers roughly the 20%-430% range Chrome's own zoom slider
// allows.
const ZOOM_STEP = 0.5;
const MIN_ZOOM_LEVEL = -8;
const MAX_ZOOM_LEVEL = 8;

const ZOOM_IN_KEYS = new Set(['+', '=', 'Add']);
const ZOOM_OUT_KEYS = new Set(['-', '_', 'Subtract']);

function clampZoomLevel(level: number): number {
  return Math.min(MAX_ZOOM_LEVEL, Math.max(MIN_ZOOM_LEVEL, level));
}

function zoomIn(contents: WebContents): void {
  contents.zoomLevel = clampZoomLevel(contents.zoomLevel + ZOOM_STEP);
}

function zoomOut(contents: WebContents): void {
  contents.zoomLevel = clampZoomLevel(contents.zoomLevel - ZOOM_STEP);
}

/**
 * Browser-style zoom for a window: Ctrl/Cmd+scroll (and trackpad pinch, which
 * Chromium reports the same way) plus Ctrl/Cmd +/-/0 keyboard shortcuts.
 * Electron doesn't apply either by default -- 'zoom-changed' is emitted but
 * left for the app to act on, and there's no menu/accelerator wired up here.
 */
export function registerZoomShortcuts(window: BrowserWindow): void {
  const { webContents } = window;

  webContents.on('zoom-changed', (_event, zoomDirection) => {
    if (zoomDirection === 'in') {
      zoomIn(webContents);
    } else {
      zoomOut(webContents);
    }
  });

  webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return;
    if (!input.control && !input.meta) return;

    if (ZOOM_IN_KEYS.has(input.key)) {
      zoomIn(webContents);
    } else if (ZOOM_OUT_KEYS.has(input.key)) {
      zoomOut(webContents);
    } else if (input.key === '0') {
      webContents.zoomLevel = 0;
    }
  });
}
