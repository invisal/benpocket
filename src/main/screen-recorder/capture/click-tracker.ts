import { uIOhook, type UiohookMouseEvent } from 'uiohook-napi';
import type { WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { CursorTrackerBounds } from './cursor-tracker';

/**
 * Listens for real global mousedown events via uiohook-napi's native input
 * hook (the only way to see clicks that land on other windows/apps -- unlike
 * cursor *position*, Electron has no built-in API for this). Requires an
 * electron-rebuild step for the native addon, and on macOS the app must be
 * granted Accessibility permission before uIOhook.start() actually receives
 * events (silently receives nothing until granted, rather than erroring).
 *
 * The native hook is started/stopped per recording session (not run for the
 * app's whole lifetime) so global input is only intercepted while actively
 * recording.
 */
export class ClickTracker {
  private listener: ((event: UiohookMouseEvent) => void) | null = null;
  private hookRunning = false;
  private clickCount = 0;

  start(webContents: WebContents, bounds: CursorTrackerBounds, startedAt: number): void {
    this.stop();
    this.clickCount = 0;
    console.log('[click-tracker] started, bounds:', bounds);

    this.listener = (event: UiohookMouseEvent) => {
      if (webContents.isDestroyed()) {
        this.stop();
        return;
      }
      const x = (event.x - bounds.x) / bounds.width;
      const y = (event.y - bounds.y) / bounds.height;
      // Same reasoning as cursor-tracker.ts: ignore clicks outside the
      // recorded screen rather than clamping them to the edge.
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      this.clickCount += 1;
      webContents.send(IpcChannels.CursorClickSample, { atMs: Date.now() - startedAt, x, y });
    };
    uIOhook.on('mousedown', this.listener);

    if (!this.hookRunning) {
      uIOhook.start();
      this.hookRunning = true;
    }
  }

  stop(): void {
    if (this.listener) {
      uIOhook.removeListener('mousedown', this.listener);
      console.log(`[click-tracker] stopped, captured ${this.clickCount} click(s)`);
      this.listener = null;
    }
    if (this.hookRunning) {
      uIOhook.stop();
      this.hookRunning = false;
    }
  }
}

export const clickTracker = new ClickTracker();
