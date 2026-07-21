/**
 * A bundler `?url` import for `web-demuxer/wasm` resolves inconsistently
 * inside the export Worker between `electron-vite dev` (Vite dev-server
 * module graph) and a production build, and can hang indefinitely instead
 * of failing fast. Serving the WASM file as a static asset from
 * `src/renderer/public/` (copied there from `web-demuxer`'s package) sidesteps
 * the bundler-resolution problem, per web-demuxer's own recommended setup.
 *
 * `WebDemuxer` spawns its own internal WASM Worker, and that worker's base
 * location has no relationship to whichever page/worker constructed it, so
 * `wasmFilePath` must be a fully-qualified URL, not a relative one -- a
 * root-relative path (leading `/`) resolves against the filesystem root
 * under Electron's `file://` page loading, not the app's own directory.
 *
 * Must be called on the main thread (uses `window.location`): every HTML
 * entry point (`index.html`, etc.) and `web-demuxer.wasm` live in the same
 * output directory, so a same-directory relative reference resolves
 * correctly in both `electron-vite dev` and a production build. The export
 * Worker's own bundled script lives one directory deeper, so it can't
 * reliably recompute this itself -- the caller must resolve it here once
 * and thread the result through (e.g. via the Worker's `postMessage` payload).
 */
export function resolveWebDemuxerWasmPath(): string {
  return new URL('web-demuxer.wasm', window.location.href).href;
}
