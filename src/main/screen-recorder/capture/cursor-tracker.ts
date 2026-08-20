import { screen, type WebContents } from 'electron';
import type { UiohookMouseEvent } from 'uiohook-napi';
import { IpcChannels } from '@shared/ipc-channels';
import { loadUiohook, acquireUiohook, releaseUiohook } from './uiohook-loader';

const POLL_INTERVAL_MS = 20; // 50Hz -- smoothCursorPath()/sampleCursorPath() handle the rest.

export interface CursorTrackerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Tracks the system cursor's position while a recording is active and pushes
 * normalized (0-1, relative to `bounds`) samples to the renderer.
 * Position-only: there is no equivalent Electron API for global mouse clicks
 * outside the app's own windows, so click-based effects aren't driven by
 * this (see click-tracker.ts).
 *
 * On Windows, drives samples off uiohook-napi's native `mousemove` hook
 * (same one click-tracker.ts uses, see uiohook-loader.ts) instead of
 * polling `screen.getCursorScreenPoint()` -- polling at a fixed 20ms
 * interval reads as visibly flicky there (Node's default Windows timer
 * resolution is coarser than macOS's, so `setInterval` firings bunch up and
 * gap unevenly under any main-process load, feeding the spring smoothing in
 * cursor-path.ts an unevenly-paced raw path), whereas the native hook
 * delivers real OS mouse-move events without going through Node's timer
 * queue at all. Polling stays the default elsewhere (macOS's timer
 * resolution doesn't show the same issue, and this avoids relying on
 * uiohook -- with its own Accessibility-permission gate -- on a platform
 * that doesn't need it for smooth position tracking).
 */
export class CursorTracker {
  private timer: NodeJS.Timeout | null = null;
  private uiohookListener: ((event: UiohookMouseEvent) => void) | null = null;
  private uiohook: Awaited<ReturnType<typeof loadUiohook>> = null;
  private bounds: CursorTrackerBounds = { x: 0, y: 0, width: 1, height: 1 };
  private sentCount = 0;
  private skippedOutOfBoundsCount = 0;
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
    this.sentCount = 0;
    this.skippedOutOfBoundsCount = 0;

    const emit = (screenX: number, screenY: number): void => {
      if (webContents.isDestroyed()) {
        this.stop();
        return;
      }
      const x = (screenX - this.bounds.x) / this.bounds.width;
      const y = (screenY - this.bounds.y) / this.bounds.height;
      // Skip samples while the cursor is outside the captured area rather
      // than clamping -- clamped edge points would otherwise drag the
      // smoothed path to the border every time the user's mouse leaves the
      // recorded screen.
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        this.skippedOutOfBoundsCount += 1;
        return;
      }
      this.sentCount += 1;
      webContents.send(IpcChannels.CursorPositionSample, { atMs: Date.now() - startedAt, x, y });
    };

    if (process.platform === 'win32') {
      const uiohook = await loadUiohook();
      if (!uiohook || thisGeneration !== this.generation) return;
      console.log('[cursor-tracker] started (native mousemove hook), bounds:', bounds);
      this.uiohookListener = (event) => emit(event.x, event.y);
      uiohook.uIOhook.on('mousemove', this.uiohookListener);
      this.uiohook = uiohook;
      acquireUiohook(uiohook);
      return;
    }

    console.log('[cursor-tracker] started (polling), bounds:', bounds);
    this.timer = setInterval(() => {
      const point = screen.getCursorScreenPoint();
      emit(point.x, point.y);
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    this.generation++;
    if (this.timer || (this.uiohookListener && this.uiohook)) {
      console.log(
        `[cursor-tracker] stopped, sent ${this.sentCount} sample(s), skipped ${this.skippedOutOfBoundsCount} out-of-bounds`
      );
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.uiohookListener && this.uiohook) {
      this.uiohook.uIOhook.removeListener('mousemove', this.uiohookListener);
      releaseUiohook(this.uiohook);
    }
    this.uiohookListener = null;
    this.uiohook = null;
  }

  /** Re-bases normalization onto a freshly-queried rect -- see window-bounds-poller.ts. */
  updateBounds(bounds: CursorTrackerBounds): void {
    this.bounds = bounds;
  }
}

export const cursorTracker = new CursorTracker();
