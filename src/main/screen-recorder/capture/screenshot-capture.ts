import { desktopCapturer, screen, type BrowserWindow } from 'electron';
import { hideCaptureWindow, restoreCaptureWindow } from '../windows/window-visibility';

export interface ScreenshotCaptureRequest {
  sourceId: string;
  displayId?: string;
  hideBeforeCapture?: boolean;
  focusAfterRestore?: boolean;
}

function captureSizeForRequest(request: ScreenshotCaptureRequest): {
  width: number;
  height: number;
} {
  const displays = screen.getAllDisplays();
  const display = request.displayId
    ? displays.find((item) => String(item.id) === request.displayId)
    : screen.getPrimaryDisplay();

  const target = display ?? screen.getPrimaryDisplay();
  return {
    width: Math.round(target.bounds.width * target.scaleFactor),
    height: Math.round(target.bounds.height * target.scaleFactor)
  };
}

/** Captures a chosen display as PNG bytes via desktopCapturer (main process). */
export async function captureScreenPng(request: ScreenshotCaptureRequest): Promise<Buffer> {
  const { width, height } = captureSizeForRequest(request);

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width, height }
  });

  const source = sources.find((item) => item.id === request.sourceId);
  if (!source) throw new Error('Capture source not found.');

  const png = source.thumbnail.toPNG();
  if (!png.length) throw new Error('Captured screenshot is empty.');

  return png;
}

/** Hide, capture, and restore in one main-process turn so the renderer is not suspended mid-flow. */
export async function captureScreenPngWithHide(
  win: BrowserWindow | null,
  request: ScreenshotCaptureRequest
): Promise<Buffer> {
  const shouldHide = request.hideBeforeCapture ?? false;

  if (shouldHide && win?.isFocused()) {
    win.blur();
  }

  if (shouldHide) {
    // ponytail: darwin uses mainOnly — app.hide() suspends the renderer before
    // the IPC reply returns; hiding only the window keeps capture off-screen.
    await hideCaptureWindow(win, process.platform === 'darwin' ? { mainOnly: true } : undefined);
  }

  try {
    return await captureScreenPng(request);
  } finally {
    if (shouldHide) {
      await restoreCaptureWindow(win, { focus: request.focusAfterRestore ?? true });
    }
  }
}
