import { app, type BrowserWindow } from 'electron';

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
  if (win.isFocused()) win.blur();
  const minimized = waitForWindowMinimized(win);
  win.minimize();
  await minimized;
}

export async function restoreCaptureWindow(
  win: BrowserWindow | null,
  options?: { focus?: boolean }
): Promise<void> {
  if (!win) return;

  const shouldFocus = options?.focus ?? true;

  if (process.platform === 'darwin') {
    app.show();
    if (win.isMinimized()) win.restore();
    if (!win.isVisible()) win.show();
    if (shouldFocus) win.focus();
    else if (win.isFocused()) win.blur();
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
