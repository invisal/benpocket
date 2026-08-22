import type { WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { ResizeRotationDeg } from '@shared/cursor-path';
import { cursorTracker, type CursorTrackerBounds } from './cursor-tracker';
import { clickTracker } from './click-tracker';
import { cursorShapeTracker } from './cursor-shape-tracker';
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
 * Which of the 4 icon orientations a whole-window bounds change was --
 * derived purely from the bounds delta itself (`previous` vs `current`),
 * never from the cursor's own recorded position. That matters because for a
 * followed live window, `cursorTracker`/`clickTracker`'s normalization is
 * continuously rebased onto this same live rect (`updateBounds`, below) --
 * during an active corner drag, the cursor's *recorded* fractional position
 * can sit at a near-constant spot near a corner for the whole drag even as
 * the window visibly resizes, so reading direction from that path
 * (`resolveResizeRotationDeg`, @shared/cursor-path) doesn't hold up there.
 * The bounds delta has no such problem -- it's ground truth for how the
 * rect just changed, independent of any rebasing.
 *
 * Only called once `sizeChanged` has already confirmed at least one
 * dimension moved. Corner disambiguation cares only *whether* an edge
 * moved, not which way: `x` only ever changes at all when the *left* edge
 * (not the right one) is the one being dragged -- same reasoning for `y`/
 * the top edge -- so the top-left and bottom-right corners (the two ends of
 * the same "\" diagonal) both leave `x`/`y` changing together (both moved,
 * or neither did), while top-right/bottom-left (the "/" diagonal) leave
 * exactly one of them moving.
 */
export function resolveWindowResizeRotationDeg(
  previous: CursorTrackerBounds,
  current: CursorTrackerBounds
): ResizeRotationDeg {
  const widthChanged = current.width !== previous.width;
  const heightChanged = current.height !== previous.height;
  if (widthChanged && !heightChanged) return 0;
  if (heightChanged && !widthChanged) return 90;
  if (!widthChanged && !heightChanged) return 0;
  const leftEdgeMoved = current.x !== previous.x;
  const topEdgeMoved = current.y !== previous.y;
  return leftEdgeMoved === topEdgeMoved ? 45 : 135;
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
  /**
   * Bumped on every poll tick *within* one session -- `generation` alone
   * only guards against a stale result crossing a start()/stop() boundary,
   * but `getWindowBoundsLive` spawns a fresh helper process per call (see
   * its own doc), so nothing stops two polls' queries from being in flight
   * at once and resolving out of order under load. `lastAppliedSeq` is a
   * watermark: a result only gets applied if its own poll's sequence number
   * is newer than the last one actually applied, so a late-arriving older
   * query can't rebase the trackers onto stale bounds or get diffed against
   * `lastBounds` as if it were the latest sighting (which would otherwise
   * risk a false resize sample, or mask a real one).
   */
  private lastAppliedSeq = 0;
  private nextSeq = 0;

  start(windowId: number, webContents: WebContents, startedAt: number): void {
    this.stop();
    const thisGeneration = ++this.generation;
    this.lastBounds = null;
    this.lastAppliedSeq = 0;
    this.nextSeq = 0;
    this.timer = setInterval(() => {
      if (webContents.isDestroyed()) {
        this.stop();
        return;
      }
      const seq = ++this.nextSeq;
      void getWindowBoundsLive(windowId).then((bounds) => {
        if (!bounds || thisGeneration !== this.generation || seq <= this.lastAppliedSeq) return;
        this.lastAppliedSeq = seq;
        cursorTracker.updateBounds(bounds);
        clickTracker.updateBounds(bounds);
        cursorShapeTracker.updateBounds(bounds);
        if (this.lastBounds && sizeChanged(this.lastBounds, bounds) && !webContents.isDestroyed()) {
          webContents.send(IpcChannels.WindowResizeSample, {
            atMs: Date.now() - startedAt,
            rotationDeg: resolveWindowResizeRotationDeg(this.lastBounds, bounds)
          });
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
