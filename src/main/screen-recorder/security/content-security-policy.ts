import { app, session } from 'electron';

// A static <meta http-equiv="Content-Security-Policy"> tag in index.html
// can't tell dev and production apart, and Vite's dev server / React Fast
// Refresh needs 'unsafe-eval' + a websocket connect-src for HMR that a
// production build should never need. Setting the header per-response here
// lets us keep production locked down while dev actually works.
//
// img-src needs 'data:' because capture source thumbnails are data URLs
// (see main/screen-recorder/capture/screen-source-provider.ts) and Screen Capture preview
// may use blob: or data: URLs. media-src needs 'blob:' because recorded
// video preview uses an in-memory Blob URL (see
// features/recording/engine/capture-engine.ts) rather than writing to disk
// and reloading from a file:// URL. connect-src also needs 'blob:' for the
// same URL: <video src> hits media-src, but decoding it for the timeline's
// waveform (features/timeline/lib/decode-waveform-peaks.ts) does
// `fetch(previewUrl)` first, which CSP checks against connect-src instead.
export function applyContentSecurityPolicy(): void {
  const isDev = !app.isPackaged;

  const policy = isDev
    ? [
        "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "connect-src 'self' blob: ws: wss: http://localhost:* https://localhost:*"
      ].join('; ')
    : [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "media-src 'self' blob:",
        "connect-src 'self' blob:"
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
