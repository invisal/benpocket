import type * as UiohookNapiModule from 'uiohook-napi';

/**
 * uiohook-napi ships prebuilt native binaries for a specific, closed set of
 * platform/arch combinations (darwin x64/arm64, win32 x64/arm64, linux
 * x64/arm64/loong64 as of this writing). Loading it on anything outside that
 * set throws synchronously via `node-gyp-build`. A static top-level `import`
 * would let that throw crash the whole main process's module loading before
 * a window even opens -- loading it lazily here instead, once, with the
 * outcome cached, means an unsupported architecture just gets no native
 * input tracking instead of the app refusing to launch at all.
 *
 * Shared by cursor-tracker.ts and click-tracker.ts, which can both be
 * listening on the *same* global native hook at once (`uIOhook` is a
 * process-wide singleton -- see uiohook-napi's own source, there's exactly
 * one underlying `start()`/`stop()`, not one per listener). `acquireUiohook`/
 * `releaseUiohook` reference-count that shared start/stop so one tracker's
 * `stop()` can't kill the hook out from under the other while a recording is
 * still using it.
 */
let uiohookModule: typeof UiohookNapiModule | null | undefined;
export async function loadUiohook(): Promise<typeof UiohookNapiModule | null> {
  if (uiohookModule !== undefined) return uiohookModule;
  try {
    uiohookModule = await import('uiohook-napi');
  } catch (err) {
    console.error(
      '[uiohook-loader] uiohook-napi has no native build for this platform/architecture -- native input tracking disabled for this session:',
      err
    );
    uiohookModule = null;
  }
  return uiohookModule;
}

let refCount = 0;

/** Starts the shared native hook if this is the first active tracker; otherwise just bumps the refcount. */
export function acquireUiohook(uiohook: typeof UiohookNapiModule): void {
  if (refCount === 0) uiohook.uIOhook.start();
  refCount++;
}

/** Stops the shared native hook once the last active tracker has released it. */
export function releaseUiohook(uiohook: typeof UiohookNapiModule): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0) uiohook.uIOhook.stop();
}
