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
  options?: { mainOnly?: boolean }
): Promise<void> {
  if (!win) return;

  if (process.platform === 'darwin' && !options?.mainOnly) {
    if (app.isHidden()) return;
    const hidden = waitForWindowHidden(win);
    app.hide();
    await hidden;
    return;
  }

  if (!win.isVisible()) return;
  const hidden = waitForWindowHidden(win);
  win.hide();
  await hidden;

  // Wayland/X11: window hide is async in the compositor — give capture a beat
  // so the next PipeWire/desktopCapturer frame does not still include us.
  if (process.platform === 'linux') {
    await new Promise<void>((resolve) => setTimeout(resolve, 100));
  }
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
