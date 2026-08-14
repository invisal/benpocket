import { app, screen, type BrowserWindow } from 'electron';

async function waitForWindowHidden(win: BrowserWindow): Promise<void> {
  if (!win.isVisible()) return;

  await new Promise<void>((resolve) => {
    const done = (): void => {
      win.removeListener('hide', done);
      resolve();
    };
    win.on('hide', done);
    if (!win.isVisible()) done();
  });
}

async function waitForWindowMinimized(win: BrowserWindow): Promise<void> {
  if (win.isMinimized()) return;

  await new Promise<void>((resolve) => {
    const done = (): void => {
      win.removeListener('minimize', done);
      resolve();
    };
    win.on('minimize', done);
    if (win.isMinimized()) done();
  });
}

async function waitForWindowShown(win: BrowserWindow): Promise<void> {
  if (win.isVisible()) return;

  await new Promise<void>((resolve) => {
    const done = (): void => {
      win.removeListener('show', done);
      resolve();
    };
    win.on('show', done);
    if (win.isVisible()) done();
  });
}

// macOS: dock.hide() is a no-op if called within ~1s of dock.show().
let lastDockShowAt = 0;
let hideDockTimer: ReturnType<typeof setTimeout> | null = null;

/** Bring back the Dock / taskbar presence (close-to-tray undo, capture restore). */
export function showAppLauncherIcon(win?: BrowserWindow | null): void {
  if (win && !win.isDestroyed()) win.setSkipTaskbar(false);
  if (process.platform !== 'darwin') return;
  if (hideDockTimer) {
    clearTimeout(hideDockTimer);
    hideDockTimer = null;
  }
  lastDockShowAt = Date.now();
  void app.dock?.show();
}

function hideAppLauncherIcon(): void {
  if (process.platform !== 'darwin') return;
  if (hideDockTimer) clearTimeout(hideDockTimer);
  const wait = Math.max(0, 1100 - (Date.now() - lastDockShowAt));
  const run = (): void => {
    hideDockTimer = null;
    if (app.dock?.isVisible()) app.dock.hide();
  };
  if (wait === 0) run();
  else hideDockTimer = setTimeout(run, wait);
}

/**
 * Close (X) → tray: hide the window and drop Dock / taskbar presence so only
 * the menu-bar / notification-area tray remains.
 */
export function withdrawWindowToTray(win: BrowserWindow): void {
  win.hide();
  win.setSkipTaskbar(true);
  hideAppLauncherIcon();
}

export async function hideCaptureWindow(
  win: BrowserWindow | null,
  options?: { mainOnly?: boolean; settleMs?: number }
): Promise<void> {
  if (!win) return;

  if (process.platform === 'darwin' && !options?.mainOnly) {
    if (app.isHidden()) return;
    const hidden = waitForWindowHidden(win);
    app.hide();
    await hidden;
    return;
  }

  // Already hidden (e.g. renderer hid first): still wait so the compositor
  // finishes removing us before the caller freezes a screenshot backdrop.
  if (!win.isVisible()) {
    if (process.platform === 'linux') {
      await new Promise<void>((resolve) => setTimeout(resolve, options?.settleMs ?? 100));
    }
    return;
  }

  if (win.isFocused()) win.blur();

  const hidden = waitForWindowHidden(win);
  win.hide();
  await hidden;

  // Wayland/X11: window hide is async in the compositor — give capture a beat
  // so the next frame / portal backdrop does not still include us.
  if (process.platform === 'linux') {
    await new Promise<void>((resolve) => setTimeout(resolve, options?.settleMs ?? 100));
  }
}

/**
 * Minimizes `win` to the Dock instead of fully hiding it -- unlike
 * `hideCaptureWindow`, this leaves a clickable Dock icon/thumbnail behind so
 * there's an obvious, discoverable way back to it. Removes it from the
 * screen just as effectively as a hide for the one thing that matters to a
 * caller like recorder-toolbar-window.ts (not showing up in a 'Display'
 * capture) -- `restoreCaptureWindow` already un-minimizes on every platform
 * (see its `isMinimized()` checks below), so no separate restore path is
 * needed for callers that use this instead of `hideCaptureWindow`.
 */
export async function minimizeCaptureWindow(win: BrowserWindow | null): Promise<void> {
  if (!win || win.isMinimized()) return;
  // Close-to-tray left the window hidden and the Dock gone — restore launcher
  // presence so dock/taskbar can bring BenPocket back into a shot. Stay hidden
  // (don't minimize): minimizing a hidden window is flaky across platforms.
  showAppLauncherIcon(win);
  if (!win.isVisible()) return;
  if (win.isFocused()) win.blur();
  const minimized = waitForWindowMinimized(win);
  win.minimize();
  await minimized;
}

export function isCursorOverWindow(win: BrowserWindow): boolean {
  const point = screen.getCursorScreenPoint();
  const bounds = win.getBounds();
  return (
    point.x >= bounds.x &&
    point.x < bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y < bounds.y + bounds.height
  );
}

/**
 * Temporarily make `win` ineligible as AppKit's next key window. Closing or
 * blurring a `type: 'panel'` otherwise promotes the owner and brings BenPocket
 * forward when the user clicked the desktop (no other app to stay in front).
 */
export function suppressWindowActivation(win: BrowserWindow | null): () => void {
  if (!win || win.isDestroyed()) return () => {};
  win.setFocusable(false);
  if (win.isFocused()) win.blur();
  return () => {
    if (!win.isDestroyed()) win.setFocusable(true);
  };
}

export async function restoreCaptureWindow(
  win: BrowserWindow | null,
  options?: { focus?: boolean }
): Promise<void> {
  if (!win) return;

  showAppLauncherIcon(win);
  const shouldFocus = options?.focus ?? true;

  if (process.platform === 'darwin') {
    if (shouldFocus) {
      app.show();
      if (win.isMinimized()) win.restore();
      if (!win.isVisible()) win.show();
      win.focus();
      return;
    }
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.showInactive();
    if (win.isFocused()) win.blur();
    return;
  }

  if (win.isMinimized()) win.restore();
  if (!win.isVisible()) {
    const shown = waitForWindowShown(win);
    win.show();
    await shown;
  }

  if (process.platform === 'linux') {
    if (shouldFocus) {
      win.setAlwaysOnTop(true, 'screen-saver');
      win.focus();
      win.setAlwaysOnTop(false);
    } else if (win.isFocused()) {
      win.blur();
    }
    return;
  }

  if (shouldFocus) win.focus();
  else if (win.isFocused()) win.blur();
}
