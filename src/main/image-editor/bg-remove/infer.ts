import { Tensor } from 'onnxruntime-node';
import sharp from 'sharp';
import type { BgRemoveModel } from './models';
import { modelPath } from './modelCache';
import { loadSession } from '../model/session';
import type { RawPlane } from '../model/pixels';

export const BG_REMOVE_CANCELLED_MESSAGE = 'background removal cancelled';

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

/**
 * Converts an HWC uint8 RGB tile into the CHW float32 tensor the model expects, matching the
 * reference `rembg` preprocessing exactly (`BaseSession.normalize` in danielgatis/rembg): scale
 * by the tile's own max byte value -- not a fixed 255 -- then apply `(x - mean) / std` per
 * channel. Each model's `mean`/`std` (see `models.ts`) mirrors what it was trained/exported with.
 */
export function hwcUint8ToChwNormalized(
  rgb: Buffer,
  size: number,
  mean: readonly [number, number, number],
  std: readonly [number, number, number]
): Float32Array {
  let max = 1e-6;
  for (let i = 0; i < rgb.length; i++) if (rgb[i] > max) max = rgb[i];

  const out = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i++) {
    const srcIdx = i * 3;
    out[i] = rgb[srcIdx] / max / std[0] - mean[0] / std[0];
    out[plane + i] = rgb[srcIdx + 1] / max / std[1] - mean[1] / std[1];
    out[2 * plane + i] = rgb[srcIdx + 2] / max / std[2] - mean[2] / std[2];
  }
  return out;
}

/**
 * Runs `model` (a fixed `inputSize x inputSize` saliency network -- see `models.ts`) over `rgb`
 * whole, unlike upscale's tiling: these graphs are meant to see the full image at once to judge
 * foreground/background. Returns a single-channel alpha plane at `rgb`'s own dimensions, ready to
 * join back onto the source via `recombineWithAlpha` (see `model/pixels.ts`).
 */
export async function removeBackgroundAlpha(
  cacheRoot: string,
  model: BgRemoveModel,
  rgb: RawPlane,
  signal?: AbortSignal
): Promise<RawPlane> {
  if (signal?.aborted) throw new Error(BG_REMOVE_CANCELLED_MESSAGE);

  const session = await loadSession(`bg-remove:${model.id}`, modelPath(cacheRoot, model));
  const { inputSize, inputName, outputName, mean, std } = model;

  const resized = await sharp(rgb.data, {
    raw: { width: rgb.width, height: rgb.height, channels: 3 }
  })
    .resize(inputSize, inputSize, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
    .raw()
    .toBuffer();

  if (signal?.aborted) throw new Error(BG_REMOVE_CANCELLED_MESSAGE);

  const inputTensor = new Tensor(
    'float32',
    hwcUint8ToChwNormalized(resized, inputSize, mean, std),
    [1, 3, inputSize, inputSize]
  );
  const results = await session.run({ [inputName]: inputTensor });
  const output = results[outputName];
  const [, , outH, outW] = output.dims as number[];
  const pred = output.data as Float32Array;

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pred.length; i++) {
    if (pred[i] < min) min = pred[i];
    if (pred[i] > max) max = pred[i];
  }
  const range = Math.max(max - min, 1e-6);

  const maskSmall = Buffer.alloc(outW * outH);
  for (let i = 0; i < pred.length; i++) {
    maskSmall[i] = clampByte(((pred[i] - min) / range) * 255);
  }

  const maskData = await sharp(maskSmall, { raw: { width: outW, height: outH, channels: 1 } })
    .resize(rgb.width, rgb.height, { kernel: sharp.kernel.lanczos3 })
    // See the matching comment in `model/pixels.ts`'s recombineWithAlpha -- libvips widens a
    // single-band raw buffer to 3 bands during resize, so without this the returned buffer has
    // 3x the bytes callers expect for a 1-channel mask.
    .toColourspace('b-w')
    .raw()
    .toBuffer();

  return { data: maskData, width: rgb.width, height: rgb.height };
}
