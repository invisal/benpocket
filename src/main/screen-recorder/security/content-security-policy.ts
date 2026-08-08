import { app, session } from 'electron';
import { RECORDING_MEDIA_SCHEME } from '@shared/media-protocol';

// A static <meta http-equiv="Content-Security-Policy"> tag in index.html
// can't tell dev and production apart, and Vite's dev server / React Fast
// Refresh needs 'unsafe-eval' + a websocket connect-src for HMR that a
// production build should never need. Setting the header per-response here
// lets us keep production locked down while dev actually works.
//
// img-src needs 'data:' because capture source thumbnails are data URLs
// (see main/screen-recorder/capture/screen-source-provider.ts) and Screen Capture preview
// may use blob: or data: URLs. media-src needs the `benpocket-recording:`
// scheme because recording preview streams straight off disk through it
// (see security/media-protocol.ts) instead of an in-memory Blob URL --
// `blob:` stays alongside it for the few things that still do use one (the
// export pipeline's WASM demuxer input, Library's project thumbnails).
// connect-src needs the same two: <video src> hits media-src, but decoding
// the timeline's waveform (features/timeline/lib/decode-waveform-peaks.ts)
// does `fetch(previewUrl)` first, which CSP checks against connect-src
// instead. worker-src needs 'blob:' and 'data:' because the export pipeline's
// `web-demuxer` (features/export/engine/streaming-decoder.ts etc.) spins up
// its own internal workers two different ways -- its main demux worker via
// `new Worker(URL.createObjectURL(...))` (blob:) and at least one other via
// an inline `data:text/javascript;base64,...` URL -- without an explicit
// worker-src, Chromium falls back to default-src, which doesn't cover either
// scheme and blocks the worker outright (silently hangs the export rather
// than erroring, since the failure surfaces as a rejected internal promise
// inside the library, not a catchable exception here).
// connect-src also needs 'data:' because PixiJS's texture loader
// (features/export/engine/rendering/effects/background.ts's Assets.load,
// used for image/wallpaper backgrounds) probes AVIF support by `fetch()`ing
// a tiny embedded `data:image/avif;base64,...` URL the first time it loads
// an image -- that fetch is checked against connect-src, not img-src.
export function applyContentSecurityPolicy(): void {
  const isDev = !app.isPackaged;
  const mediaSrc = `'self' blob: ${RECORDING_MEDIA_SCHEME}:`;
  const connectSrc = `'self' blob: data: ${RECORDING_MEDIA_SCHEME}:`;

  const policy = isDev
    ? [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "img-src 'self' data: blob: http: https:",
        `media-src ${mediaSrc}`,
        "worker-src 'self' blob: data:",
        `connect-src ${connectSrc} ws: wss: http://localhost:* https://localhost:*`
      ].join('; ')
    : [
        "default-src 'self'",
        // 'wasm-unsafe-eval' is required for WebAssembly.instantiate()
        // (the export pipeline's WASM demuxer/encoder) -- 'unsafe-eval'
        // isn't granted here, and script-src falling back to default-src
        // doesn't cover it either.
        "script-src 'self' 'wasm-unsafe-eval'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: http: https:",
        `media-src ${mediaSrc}`,
        "worker-src 'self' blob: data:",
        `connect-src ${connectSrc}`
      ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy]
      }
    });
  });
}
