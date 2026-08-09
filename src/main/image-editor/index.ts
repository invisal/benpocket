import { ipcMain } from 'electron';
import sharp, { type Sharp } from 'sharp';

// sharp caches decoded/processed image data at the libvips level by default -- fine for a
// short-lived CLI script, but this handler lives inside Electron's main process for the entire
// app session, so that cache accumulates across every resize/crop/encode call for as long as the
// app stays open. Disabling it trades a little re-decode cost on repeat operations for not
// growing unbounded over a long session.
sharp.cache(false);

export type EncodeResult = { data: Uint8Array } | { error: string };

/**
 * Encodes a sharp pipeline with libvips's real encoders (palette-reduced PNG, mozjpeg) instead of
 * the browser canvas's `convertToBlob`, which has no compression-level or palette control and
 * produces noticeably larger files for the same pixels.
 */
function encodePipeline(image: Sharp, mimeType: string): Promise<Buffer> {
  switch (mimeType) {
    case 'image/jpeg':
      // JPEG has no alpha channel -- flatten onto white first so transparent pixels don't
      // silently turn black (sharp drops alpha for jpeg output without this).
      return image
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 92, mozjpeg: true })
        .toBuffer();
    case 'image/webp':
      return image.webp({ quality: 92 }).toBuffer();
    case 'image/png':
    default:
      return image.png({ compressionLevel: 9, palette: true }).toBuffer();
  }
}

function toUint8Array(buffer: Buffer): Uint8Array {
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

function logHeap(label: string): void {
  const m = process.memoryUsage();
  console.log(
    `[image-editor:mem] ${label} -- heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(1)}MB`,
    `heapTotal=${(m.heapTotal / 1024 / 1024).toFixed(1)}MB`,
    `external=${(m.external / 1024 / 1024).toFixed(1)}MB`,
    `arrayBuffers=${(m.arrayBuffers / 1024 / 1024).toFixed(1)}MB`,
    `rss=${(m.rss / 1024 / 1024).toFixed(1)}MB`
  );
}

/**
 * Decodes `input` (a compressed image -- the original file bytes, or whatever a previous
 * resize/crop call returned), resizes via libvips (Lanczos3), and re-encodes in one round trip.
 * The renderer never sees raw pixels here: the returned bytes are both what gets displayed
 * (decoded locally via canvas, cheap since it's now the smaller post-resize image) and what's
 * ready to write straight to disk on save -- no separate encode call needed.
 * `fit: 'fill'` stretches to the exact target dimensions rather than preserving aspect ratio --
 * the renderer already keeps W/H proportional itself when aspect-lock is on.
 */
async function resizeAndEncode(
  input: Uint8Array,
  targetWidth: number,
  targetHeight: number,
  mimeType: string
): Promise<Buffer> {
  const pipeline = sharp(Buffer.from(input)).resize(targetWidth, targetHeight, {
    fit: 'fill',
    kernel: sharp.kernel.lanczos3
  });
  return encodePipeline(pipeline, mimeType);
}

/** Same one-round-trip shape as `resizeAndEncode`, but extracting a pixel rect instead of resizing. */
async function cropAndEncode(
  input: Uint8Array,
  x: number,
  y: number,
  width: number,
  height: number,
  mimeType: string
): Promise<Buffer> {
  const pipeline = sharp(Buffer.from(input)).extract({
    left: Math.max(0, Math.round(x)),
    top: Math.max(0, Math.round(y)),
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height))
  });
  return encodePipeline(pipeline, mimeType);
}

/** Plain re-encode with no geometry change -- used by tools (Context-aware Resize/Removal) that
 * synthesize pixels locally (via `lib/inpaint/`, not sharp) and only need the final compressed bytes. */
async function encode(input: Uint8Array, mimeType: string): Promise<Buffer> {
  return encodePipeline(sharp(Buffer.from(input)), mimeType);
}

export function registerImageEditorHandlers(): void {
  console.log('[image-editor] registerImageEditorHandlers() called');
  logHeap('at registration');

  ipcMain.handle(
    'image-editor:resize',
    async (
      _,
      input: Uint8Array,
      targetWidth: number,
      targetHeight: number,
      mimeType: string
    ): Promise<EncodeResult> => {
      console.log(
        '[image-editor:resize] received',
        input.byteLength,
        'bytes, target',
        targetWidth,
        'x',
        targetHeight,
        mimeType
      );
      logHeap('resize: before');
      try {
        const data = await resizeAndEncode(input, targetWidth, targetHeight, mimeType);
        console.log('[image-editor:resize] ok ->', data.byteLength, 'bytes');
        logHeap('resize: after');
        return { data: toUint8Array(data) };
      } catch (err) {
        console.error('[image-editor:resize] failed:', err);
        logHeap('resize: after error');
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    'image-editor:crop',
    async (
      _,
      input: Uint8Array,
      x: number,
      y: number,
      width: number,
      height: number,
      mimeType: string
    ): Promise<EncodeResult> => {
      console.log(
        '[image-editor:crop] received',
        input.byteLength,
        'bytes, rect',
        x,
        y,
        width,
        height,
        mimeType
      );
      try {
        const data = await cropAndEncode(input, x, y, width, height, mimeType);
        console.log('[image-editor:crop] ok ->', data.byteLength, 'bytes');
        return { data: toUint8Array(data) };
      } catch (err) {
        console.error('[image-editor:crop] failed:', err);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }
  );

  ipcMain.handle(
    'image-editor:encode',
    async (_, input: Uint8Array, mimeType: string): Promise<EncodeResult> => {
      console.log('[image-editor:encode] received', input.byteLength, 'bytes, target', mimeType);
      try {
        const data = await encode(input, mimeType);
        console.log('[image-editor:encode] ok ->', data.byteLength, 'bytes');
        return { data: toUint8Array(data) };
      } catch (err) {
        console.error('[image-editor:encode] failed:', err);
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }
  );
}
