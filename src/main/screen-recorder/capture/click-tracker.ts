import type * as UiohookNapiModule from 'uiohook-napi';
import type { UiohookMouseEvent } from 'uiohook-napi';
import { screen, type WebContents } from 'electron';
import { IpcChannels } from '@shared/ipc-channels';
import type { CursorTrackerBounds } from './cursor-tracker';

/**
 * uiohook-napi ships prebuilt native binaries for a specific, closed set of
 * platform/arch combinations (see its own `prebuilds/` directory -- darwin
 * x64/arm64, win32 x64/arm64, linux x64/arm64/loong64 as of this writing).
 * Loading it on anything outside that set (32-bit ARM, riscv64, s390x,
 * ppc64, an unsupported libc like musl/Alpine, ...) throws synchronously via
 * `node-gyp-build` ("No native build was found for ..."). A static top-level
 * `import` would let that throw crash the whole main process's module
 * loading before a window even opens -- loading it lazily here instead,
 * once, with the outcome cached, means an unsupported architecture just
 * gets no click tracking (the same "silently receives nothing" outcome this
 * module already documents for macOS's ungranted-Accessibility case)
 * instead of the app refusing to launch at all.
 */
let uiohookModule: typeof UiohookNapiModule | null | undefined;
async function loadUiohook(): Promise<typeof UiohookNapiModule | null> {
  if (uiohookModule !== undefined) return uiohookModule;
  try {
    uiohookModule = await import('uiohook-napi');
  } catch (err) {
    console.error(
      '[click-tracker] uiohook-napi has no native build for this platform/architecture -- click tracking disabled for this session:',
      err
    );
    uiohookModule = null;
  }
  return uiohookModule;
}

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
  private bounds: CursorTrackerBounds = { x: 0, y: 0, width: 1, height: 1 };
  private hookRunning = false;
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

    this.listener = (event: UiohookMouseEvent) => {
      if (webContents.isDestroyed()) {
        this.stop();
        return;
      }
      // uiohook-napi's native hook reports screen *physical* pixels on
      // win32/linux (unlike Electron's own screen APIs, always DIP -- see
      // cursor-tracker.ts's `getCursorScreenPoint()`), so on a scaled
      // display (125%/150%/200%, the common case on Windows) a raw
      // `event.x`/`event.y` doesn't line up with `this.bounds` (sourced
      // from `display.bounds`, DIP) without this conversion first --
      // clicks would normalize to the wrong fraction of the frame, and
      // anything in the right/bottom portion of a scaled screen would
      // compute `x`/`y` > 1 and get silently dropped by the out-of-bounds
      // check below. `screenToDipPoint` is documented `@platform
      // win32,linux` -- macOS points already match Electron's DIP space
      // natively (Quartz Event Services reports the same global point
      // space `NSScreen`/Electron's `screen` module uses, Retina
      // included), so skip the conversion there rather than call an API
      // that's only defined for the other two platforms.
      const point =
        process.platform === 'darwin'
          ? { x: event.x, y: event.y }
          : screen.screenToDipPoint({ x: event.x, y: event.y });
      const x = (point.x - this.bounds.x) / this.bounds.width;
      const y = (point.y - this.bounds.y) / this.bounds.height;
      // Same reasoning as cursor-tracker.ts: ignore clicks outside the
      // recorded screen rather than clamping them to the edge.
      if (x < 0 || x > 1 || y < 0 || y > 1) return;
      this.clickCount += 1;
      webContents.send(IpcChannels.CursorClickSample, { atMs: Date.now() - startedAt, x, y });
    };
    uiohook.uIOhook.on('mousedown', this.listener);

    if (!this.hookRunning) {
      uiohook.uIOhook.start();
      this.hookRunning = true;
    }
  }

  stop(): void {
    this.generation++;
    // uiohookModule is only undefined if start() was never called yet this
    // process -- nothing to tear down in that case, and no reason to trigger
    // (and pay for) the lazy load just to find that out.
    const uiohook = uiohookModule;
    if (this.listener && uiohook) {
      uiohook.uIOhook.removeListener('mousedown', this.listener);
      console.log(`[click-tracker] stopped, captured ${this.clickCount} click(s)`);
    }
    this.listener = null;
    if (this.hookRunning && uiohook) {
      uiohook.uIOhook.stop();
    }
    this.hookRunning = false;
  }

  /** Re-bases normalization onto a freshly-queried rect -- see window-bounds-poller.ts. */
  updateBounds(bounds: CursorTrackerBounds): void {
    this.bounds = bounds;
  }
}

export const clickTracker = new ClickTracker();
