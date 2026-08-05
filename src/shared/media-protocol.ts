/**
 * Custom scheme the editor's `<video>` elements (and CutTimeline's waveform
 * `fetch`) load recordings from instead of an in-memory `blob:` URL --
 * see main/screen-recorder/security/media-protocol.ts for the `protocol.handle`
 * side. Streaming straight off disk (with real Range-request/seek support,
 * same as a `file://` load) avoids two problems the old
 * `readFileBytes` + `URL.createObjectURL(new Blob([...]))` approach had:
 * reading a whole (potentially multi-GB) recording into memory and shipping
 * every byte across IPC before the preview could show anything, and --
 * separately -- Chromium spuriously failing one of several concurrent
 * readers on the *same* blob: URL with `MediaError.MEDIA_ERR_NETWORK`
 * (PreviewStage's two <video> elements and CutTimeline's waveform decode all
 * load the same recording at once on editor mount).
 *
 * Kept in `shared/` rather than duplicated: the exact scheme + prefix format
 * has to match byte-for-byte between where main registers/serves it and
 * where the renderer constructs URLs against it.
 */
export const RECORDING_MEDIA_SCHEME = 'benpocket-recording';
const URL_PREFIX = `${RECORDING_MEDIA_SCHEME}://local/`;

/** Renderer side: build the `<video src>` / `fetch()` URL for a recording's on-disk path. */
export function toRecordingMediaUrl(filePath: string): string {
  return `${URL_PREFIX}${encodeURIComponent(filePath)}`;
}

/** Main side: recover the absolute file path from a request URL for this scheme, or `null` if it doesn't match. */
export function parseRecordingMediaUrl(url: string): string | null {
  if (!url.startsWith(URL_PREFIX)) return null;
  try {
    return decodeURIComponent(url.slice(URL_PREFIX.length));
  } catch {
    return null;
  }
}
