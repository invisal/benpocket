import { BrowserWindow, clipboard, nativeImage } from 'electron';

function copyPngBufferToClipboard(png: Buffer): void {
  clipboard.writeBuffer('image/png', png);

  const image = nativeImage.createFromBuffer(png);
  if (!image.isEmpty()) {
    clipboard.writeImage(image);
  }
}

async function waitForWindowFocus(win: BrowserWindow): Promise<void> {
  if (win.isFocused()) return;

  await new Promise<void>((resolve) => {
    const done = (): void => {
      win.removeListener('focus', done);
      resolve();
    };

    win.once('focus', done);
    win.focus();
  });
}

/** Writes a PNG screenshot to the system clipboard. */
export async function copyScreenshotToClipboard(
  sender: Electron.WebContents,
  data: ArrayBuffer
): Promise<void> {
  const png = Buffer.from(data);
  if (!png.length) throw new Error('Could not copy to clipboard.');

  const win = BrowserWindow.fromWebContents(sender);
  // Main-process clipboard on macOS does not need the window focused; waiting
  // here can block the renderer until the user clicks away from the app.
  if (win && process.platform !== 'darwin') await waitForWindowFocus(win);

  copyPngBufferToClipboard(png);
}
