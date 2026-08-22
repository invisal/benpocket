import type { WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import { cursorTracker, type CursorTrackerBounds } from './cursor-tracker';
import { clickTracker } from './click-tracker';
import { getWindowBoundsLive } from './native/recording-helper';

const POLL_INTERVAL_MS = 500;

/**
 * Whether the window's *size* changed between two polls -- deliberately
 * ignores `x`/`y`: repositioning a window (dragging it by its title bar to a
 * new spot on screen) changes its origin but not its dimensions, and isn't a
 * resize. Comparing all four fields used to mean an ordinary window drag
 * fired a `WindowResizeSample` just like an actual edge/corner resize would.
 */
export function sizeChanged(a: CursorTrackerBounds, b: CursorTrackerBounds): boolean {
  return a.width !== b.width || a.height !== b.height;
}

/**
 * Keeps cursor/click tracking rebased onto a *live* window rect while
 * recording a 'window' source, instead of the one-shot bounds resolved right
 * before the recording started (see useRecordingController.ts). Without
 * this, dragging the recorded window mid-recording leaves the trackers
 * normalizing against wherever the window used to be -- samples then either
 * land at the wrong spot in the exported video or fall outside [0,1] and get
 * silently dropped (see cursor-tracker.ts/click-tracker.ts). 500ms is
 * frequent enough that a drag settles within a fraction of a second of being
 * released.
 *
 * This is also the real, factual source for the synthetic "resize" cursor
 * gesture (`WindowResizeSample`, @shared/cursor-path): whenever a poll's
 * dimensions differ from the previous one, the window's size genuinely
 * changed between those two ticks, so this emits a timestamped sample over
 * IPC the same way clicks do. An earlier version of the resize gesture
 * instead tried to infer "is this a resize drag" from cursor movement + real
 * mousedown/mouseup timestamps -- that could never reliably tell an actual
 * window-edge drag apart from any other held-and-moving gesture, so it
 * regularly misfired. Diffing this poller's own already-live bounds removes
 * the guesswork: it only ever fires for an actual window-panel resize.
 *
 * Deliberately uses `getWindowBoundsLive`, not `getWindowBoundsById` --
 * the latter is backed by ScreenCaptureKit's `SCShareableContent`, and
 * calling that repeatedly from this poller while the actual recording's own
 * `SCStream` is live in a sibling process was observed to interrupt that
 * stream (`SCStreamErrorDomain` -3805, "application connection being
 * interrupted"). See getWindowBoundsLive's doc for the Quartz-Window-
 * Services alternative this uses instead.
 */
export class WindowBoundsPoller {
  private timer: NodeJS.Timeout | null = null;
  private lastBounds: CursorTrackerBounds | null = null;
  /** Bumped on every start()/stop() so an in-flight getWindowBoundsLive() promise from a previous session (or a previous windowId) can't stomp `lastBounds`/fire a stale sample after a newer start() has already reset state -- same hazard/pattern as CursorTracker's own `generation` counter. */
  private generation = 0;

  start(windowId: number, webContents: WebContents, startedAt: number): void {
    this.stop();
    const thisGeneration = ++this.generation;
    this.lastBounds = null;
    this.timer = setInterval(() => {
      if (webContents.isDestroyed()) {
        this.stop();
        return;
      }
      void getWindowBoundsLive(windowId).then((bounds) => {
        if (!bounds || thisGeneration !== this.generation) return;
        cursorTracker.updateBounds(bounds);
        clickTracker.updateBounds(bounds);
        if (this.lastBounds && sizeChanged(this.lastBounds, bounds) && !webContents.isDestroyed()) {
          webContents.send(IpcChannels.WindowResizeSample, { atMs: Date.now() - startedAt });
        }
        this.lastBounds = bounds;
      });
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    this.generation++;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.lastBounds = null;
  }
}

export const windowBoundsPoller = new WindowBoundsPoller();
