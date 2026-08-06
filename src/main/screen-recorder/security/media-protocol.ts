import { protocol } from 'electron';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { RECORDING_MEDIA_SCHEME, parseRecordingMediaUrl } from '@shared/media-protocol';

/**
 * Must run before `app.whenReady()` -- Electron only honors
 * `registerSchemesAsPrivileged` calls made at module-evaluation time, before
 * the app is ready. `standard: true` + `supportFetchAPI` let a plain
 * `<video src>` and CutTimeline's `fetch()` both use it like any normal URL;
 * `stream: true` is what lets Chromium's media pipeline issue Range
 * requests against it for seeking, the whole reason this exists over a
 * one-shot `readFileBytes` + Blob.
 */
export function registerRecordingMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: RECORDING_MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ]);
}

const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska'
};

function contentTypeForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES_BY_EXTENSION[ext] ?? 'video/mp4';
}

/** Single `bytes=start-end` range only -- the only form any browser's media pipeline ever actually sends for progressive video/audio. */
function parseRangeHeader(
  rangeHeader: string,
  size: number
): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : size - Number(match[2]);
  const end = match[2] && match[1] ? Number(match[2]) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end >= size || start > end) {
    return null;
  }
  return { start, end };
}

/**
 * Must run after `app.whenReady()`. Streams the real file off disk directly
 * (not via `net.fetch(file://...)`) so Range-request support is explicit
 * and guaranteed rather than depending on whatever `net.fetch` happens to do
 * for a `file:` target -- video seeking needs every response (including the
 * very first, range-less one) to advertise `Accept-Ranges: bytes`, and every
 * ranged request to come back `206` with a correct `Content-Range`, for
 * Chromium's media pipeline to treat the resource as seekable at all. The
 * path comes from `parseRecordingMediaUrl`, which only ever decodes URLs
 * *this app's own renderer* constructed (see `toRecordingMediaUrl`) from
 * paths it already trusted enough to hand to the equally unrestricted
 * `export:read-file-bytes` IPC handler -- no new privilege boundary is
 * being crossed here.
 */
export function registerRecordingMediaHandler(): void {
  protocol.handle(RECORDING_MEDIA_SCHEME, async (request) => {
    const filePath = parseRecordingMediaUrl(request.url);
    if (!filePath) return new Response('Not found', { status: 404 });

    let size: number;
    try {
      size = (await stat(filePath)).size;
    } catch {
      return new Response('Not found', { status: 404 });
    }

    const contentType = contentTypeForPath(filePath);
    const rangeHeader = request.headers.get('range');
    const range = rangeHeader ? parseRangeHeader(rangeHeader, size) : null;

    if (rangeHeader && !range) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }

    const { start, end } = range ?? { start: 0, end: size - 1 };
    const nodeStream = createReadStream(filePath, { start, end });
    const body = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

    return new Response(body, {
      status: range ? 206 : 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(end - start + 1),
        'Accept-Ranges': 'bytes',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {})
      }
    });
  });
}
