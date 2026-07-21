import { session, desktopCapturer } from 'electron';

/**
 * macOS 15+ can hand `getDisplayMedia()` off to the real ScreenCaptureKit
 * picker dialog instead of our own UI -- see Electron's `useSystemPicker`.
 * Currently unused (no renderer flow opts into it yet), kept for a future
 * "Use System Picker" button -- exercising it would mean re-registering the
 * handler with `useSystemPicker: true` right before that specific call,
 * since `registerDisplayMediaHandler` below always registers with it off (a
 * session only has one active registration at a time).
 */
export function supportsNativeSystemPicker(): boolean {
  if (process.platform !== 'darwin') return false;
  const [major] = process.getSystemVersion().split('.').map(Number);
  return Number.isFinite(major) && major >= 15;
}

/**
 * The source id Screen Recorder's own in-app picker has already chosen for
 * the *next* getDisplayMedia() call -- set via `setPendingCaptureSourceId`
 * right before the renderer invokes it (see capture-engine.ts's
 * getDesktopStream). Module-level, not per-request state, since Electron
 * resolves the handler by session, not by caller.
 */
let pendingSourceId: string | null = null;

/** See `pendingSourceId`'s doc -- called by recording-handlers.ts's IPC handler. */
export function setPendingCaptureSourceId(sourceId: string): void {
  pendingSourceId = sourceId;
}

/**
 * Resolves every getDisplayMedia() call from the renderer to whichever
 * source `setPendingCaptureSourceId` was just told about, with no OS picker
 * dialog in the way -- this is what lets capture-engine.ts keep using its
 * own in-app screen/window list while still going through the *standard*
 * Screen Capture API, which is the only capture path Chromium actually
 * honors a `cursor: 'never'` constraint on (the legacy `chromeMediaSource:
 * 'desktop'` + `chromeMediaSourceId` constraint API this app used to use
 * has never supported hiding the cursor -- see Chromium bug 1007177 /
 * electron#7584, both still open as of this writing). `useSystemPicker:
 * false` is what keeps ScreenCaptureKit's own dialog from intercepting this
 * on macOS 15+ instead of running this callback.
 */
export function registerDisplayMediaHandler(): void {
  session.defaultSession.setDisplayMediaRequestHandler(
    async (_request, callback) => {
      const sourceId = pendingSourceId;
      pendingSourceId = null;
      if (!sourceId) {
        callback({});
        return;
      }
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 0, height: 0 }
      });
      const match = sources.find((source) => source.id === sourceId);
      callback(match ? { video: match } : {});
    },
    { useSystemPicker: false }
  );
}
