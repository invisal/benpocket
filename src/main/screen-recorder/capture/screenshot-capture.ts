import { execFile } from 'child_process';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { promisify } from 'util';
import { desktopCapturer, screen, type BrowserWindow, type Display } from 'electron';
import { hideCaptureWindow, restoreCaptureWindow } from '../windows/window-visibility';
import { findDisplayForCapturerId } from './display-for-source';

const execFileAsync = promisify(execFile);

export interface ScreenshotCaptureRequest {
  sourceId: string;
  displayId?: string;
  hideBeforeCapture?: boolean;
  focusAfterRestore?: boolean;
}

function resolveDisplayForRequest(request: ScreenshotCaptureRequest): Display {
  const displays = screen.getAllDisplays();
  const display = request.displayId
    ? (findDisplayForCapturerId(request.displayId) ??
      displays.find((item) => String(item.id) === request.displayId))
    : screen.getPrimaryDisplay();

  return display ?? screen.getPrimaryDisplay();
}

/**
 * macOS: shell out to the OS screenshot tool instead of desktopCapturer.
 * Chromium's capture path is sRGB-only and strips the color profile, which is
 * why its screenshots look washed out next to cmd-shift-3 on wide-gamut
 * displays. `screencapture` writes a Display P3-tagged PNG with zero Chromium
 * pixel handling, and attributes to CraftBox's existing Screen Recording
 * permission. `-x` mutes the shutter sound.
 */
async function captureDarwinPng(args: string[]): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), 'craftbox-screenshot-'));
  const file = join(dir, 'capture.png');
  try {
    await execFileAsync('/usr/sbin/screencapture', [...args, file]);
    const png = await readFile(file);
    if (!png.length) throw new Error('screencapture produced an empty file.');
    return png;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Extracts the CGWindowID from a desktopCapturer source id ("window:1234:0"). */
function parseDarwinWindowId(sourceId: string): string | null {
  const match = /^window:(\d+):/.exec(sourceId);
  return match ? match[1] : null;
}

/** Captures a display via desktopCapturer at native pixel size (Windows/X11, macOS fallback). */
async function captureScreenPngChromium(request: ScreenshotCaptureRequest): Promise<Buffer> {
  const target = resolveDisplayForRequest(request);
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(target.bounds.width * target.scaleFactor),
      height: Math.round(target.bounds.height * target.scaleFactor)
    }
  });

  const source = sources.find((item) => item.id === request.sourceId);
  if (!source) throw new Error('Capture source not found.');

  const png = source.thumbnail.toPNG();
  if (!png.length) throw new Error('Captured screenshot is empty.');

  return png;
}

/** Captures a chosen display (or, on macOS, a window) as PNG bytes in the main process. */
export async function captureScreenPng(request: ScreenshotCaptureRequest): Promise<Buffer> {
  if (process.platform === 'darwin') {
    const windowId = parseDarwinWindowId(request.sourceId);
    if (windowId) {
      // No Chromium fallback here: getSources(['screen']) cannot serve a
      // window source -- the renderer falls back to its stream-grab path
      // when this rejects. `-o` skips the drop shadow to match it.
      return captureDarwinPng(['-x', '-o', '-l', windowId]);
    }

    try {
      const { x, y, width, height } = resolveDisplayForRequest(request).bounds;
      // -R takes global coordinates in points and captures at native (Retina) scale.
      return await captureDarwinPng(['-x', '-R', `${x},${y},${width},${height}`]);
    } catch (err) {
      console.warn('[screenshot] screencapture failed, falling back to desktopCapturer:', err);
    }
  }

  return captureScreenPngChromium(request);
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
