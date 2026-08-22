import type { UiohookMouseEvent } from 'uiohook-napi';
import type { WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { CursorTrackerBounds } from './cursor-tracker';
import { loadUiohook, acquireUiohook, releaseUiohook } from './uiohook-loader';

/**
 * Listens for real global mousedown events via uiohook-napi's native input
 * hook (the only way to see clicks that land on other windows/apps --
 * unlike cursor *position*, Electron has no built-in API for this).
 * Requires an electron-rebuild step for the native addon, and on macOS the
 * app must be granted Accessibility permission before uIOhook.start()
 * actually receives events (silently receives nothing until granted, rather
 * than erroring).
 *
 * The native hook is started/stopped per recording session (not run for the
 * app's whole lifetime) so global input is only intercepted while actively
 * recording.
 */
export class ClickTracker {
  private downListener: ((event: UiohookMouseEvent) => void) | null = null;
  private uiohook: Awaited<ReturnType<typeof loadUiohook>> = null;
  private bounds: CursorTrackerBounds = { x: 0, y: 0, width: 1, height: 1 };
  private clickCount = 0;
  /** Bumped on every start()/stop() so a start() whose load-uiohook await resolves after a later stop() (or a newer start()) knows to bail instead of attaching a listener nothing asked for anymore. */
  private generation = 0;

  async start(
    webContents: WebContents,
    bounds: CursorTrackerBounds,
    startedAt: number
  ): Promise<void> {
    this.stop();
    const thisGeneration = ++this.generation;
    this.bounds = bounds;
    this.clickCount = 0;

    const uiohook = await loadUiohook();
    if (!uiohook || thisGeneration !== this.generation) return;
    console.log('[click-tracker] started, bounds:', bounds);

    this.downListener = (event: UiohookMouseEvent) => {
      if (webContents.isDestroyed()) {
        this.stop();
        return;
      }
      const x = (event.x - this.bounds.x) / this.bounds.width;
      const y = (event.y - this.bounds.y) / this.bounds.height;
      // Out-of-bounds presses are skipped -- same reasoning as
      // cursor-tracker.ts -- since this position drives where a click
      // ripple/bounce actually renders, and one outside the recorded frame
      // wouldn't be visible anyway.
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      this.clickCount += 1;
      webContents.send(IpcChannels.CursorClickSample, { atMs: Date.now() - startedAt, x, y });
    };
    uiohook.uIOhook.on('mousedown', this.downListener);
    this.uiohook = uiohook;
    acquireUiohook(uiohook);
  }

  stop(): void {
    this.generation++;
    if (this.downListener && this.uiohook) {
      this.uiohook.uIOhook.removeListener('mousedown', this.downListener);
      releaseUiohook(this.uiohook);
      console.log(`[click-tracker] stopped, captured ${this.clickCount} click(s)`);
    }
    this.downListener = null;
    this.uiohook = null;
  }

  /** Re-bases normalization onto a freshly-queried rect -- see window-bounds-poller.ts. */
  updateBounds(bounds: CursorTrackerBounds): void {
    this.bounds = bounds;
  }
}

export const clickTracker = new ClickTracker();
