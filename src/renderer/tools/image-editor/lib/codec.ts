export async function decodeToImageData(
  binary: Uint8Array<ArrayBuffer>,
  mimeType: string
): Promise<ImageData> {
  const blob = new Blob([binary], { type: mimeType });
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not create a 2D canvas context.');
    ctx.drawImage(bitmap, 0, 0);
    return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
}

/**
 * Lossless local (canvas-based, no IPC) PNG encode used purely to shrink the payload before
 * handing off to the main process. Sending *raw* RGBA pixels across the renderer/main IPC
 * boundary is tens of MB even for a modest image (4000x4000 = 64MB) and is what actually caused
 * freezes/OOM crashes, not sharp's own work (benchmarked at <50ms for a resize). PNG here is
 * just a transport format -- the main process re-encodes to the real target format/quality.
 */
async function encodeForTransport(imageData: ImageData): Promise<Uint8Array<ArrayBuffer>> {
  const canvas = new OffscreenCanvas(imageData.width, imageData.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create a 2D canvas context.');
  ctx.putImageData(imageData, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const buffer = await blob.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Encodes via `window.imageEditor.encode`, which runs through sharp (libvips) in the main
 * process -- real compression-level/palette control (`main/image-editor/index.ts`), unlike the
 * canvas's `convertToBlob` this used to use for the *final* bytes, which produced noticeably
 * larger files. The image crosses IPC as a (lossless) PNG transport encode, not raw pixels.
 */
export async function encodeImageData(
  imageData: ImageData,
  mimeType: string
): Promise<Uint8Array<ArrayBuffer>> {
  const transport = await encodeForTransport(imageData);
  const result = await window.imageEditor.encode(transport, mimeType);
  if ('error' in result) throw new Error(result.error);
  return new Uint8Array(result.data);
}
