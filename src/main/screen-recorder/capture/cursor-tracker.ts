import { screen, type WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';

const POLL_INTERVAL_MS = 20; // 50Hz -- smoothCursorPath()/sampleCursorPath() handle the rest.

export interface CursorTrackerBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Polls `screen.getCursorScreenPoint()` (the only global-cursor-position API
 * Electron exposes without a native input-hook dependency) while a recording
 * is active, and pushes normalized (0-1, relative to `bounds`) samples to the
 * renderer. Position-only: there is no equivalent Electron API for global
 * mouse clicks outside the app's own windows, so click-based effects aren't
 * driven by this.
 */
export class CursorTracker {
  private timer: NodeJS.Timeout | null = null;
  private bounds: CursorTrackerBounds = { x: 0, y: 0, width: 1, height: 1 };
  private sentCount = 0;
  private skippedOutOfBoundsCount = 0;

  start(webContents: WebContents, bounds: CursorTrackerBounds, startedAt: number): void {
    this.stop();
    this.bounds = bounds;
    this.sentCount = 0;
    this.skippedOutOfBoundsCount = 0;
    console.log('[cursor-tracker] started, bounds:', bounds);

    this.timer = setInterval(() => {
      if (webContents.isDestroyed()) {
        this.stop();
        return;
      }
      const point = screen.getCursorScreenPoint();
      const x = (point.x - this.bounds.x) / this.bounds.width;
      const y = (point.y - this.bounds.y) / this.bounds.height;
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
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) {
      console.log(
        `[cursor-tracker] stopped, sent ${this.sentCount} sample(s), skipped ${this.skippedOutOfBoundsCount} out-of-bounds`
      );
    }
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Re-bases normalization onto a freshly-queried rect -- see window-bounds-poller.ts. */
  updateBounds(bounds: CursorTrackerBounds): void {
    this.bounds = bounds;
  }
}

export const cursorTracker = new CursorTracker();
