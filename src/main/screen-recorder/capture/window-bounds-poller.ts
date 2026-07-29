import { cursorTracker } from './cursor-tracker';
import { clickTracker } from './click-tracker';
import { getWindowBoundsLive } from './native/recording-helper';

const POLL_INTERVAL_MS = 500;

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

  start(windowId: number): void {
    this.stop();
    this.timer = setInterval(() => {
      void getWindowBoundsLive(windowId).then((bounds) => {
        if (!bounds) return;
        cursorTracker.updateBounds(bounds);
        clickTracker.updateBounds(bounds);
      });
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export const windowBoundsPoller = new WindowBoundsPoller();
