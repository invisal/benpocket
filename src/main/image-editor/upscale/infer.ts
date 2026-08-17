import { InferenceSession, Tensor } from 'onnxruntime-node';
import sharp from 'sharp';
import type { UpscaleModel } from './models';
import { graphPath } from './modelCache';
import type { RawPlane } from './pixels';

export const UPSCALE_CANCELLED_MESSAGE = 'upscale cancelled';

const sessions = new Map<string, Promise<InferenceSession>>();

function executionProviders(): InferenceSession.ExecutionProviderConfig[] {
  if (process.platform === 'win32') return ['dml', 'cpu'];
  if (process.platform === 'darwin') return ['coreml', 'cpu'];
  return ['cpu'];
}

/** Sessions are created once per model id and kept alive for the app session (same rationale as
 * `sharp`'s handlers keeping no per-call state) -- creation loads and compiles the graph, which
 * is too slow to redo on every Apply click. */
function loadSession(cacheRoot: string, model: UpscaleModel): Promise<InferenceSession> {
  const cached = sessions.get(model.id);
  if (cached) return cached;

  const path = graphPath(cacheRoot, model);
  const promise = InferenceSession.create(path, {
    executionProviders: executionProviders()
  }).catch(async (err) => {
    // A GPU execution provider (DirectML/CoreML) can fail to load on machines without a
    // compatible GPU/driver -- fall back to CPU rather than breaking the feature entirely.
    console.warn(
      `[upscale] GPU execution provider unavailable for ${model.id}, falling back to CPU:`,
      err
    );
    return InferenceSession.create(path, { executionProviders: ['cpu'] });
  });

  sessions.set(model.id, promise);
  promise.catch(() => sessions.delete(model.id));
  return promise;
}

export interface AxisTile {
  coreStart: number;
  coreLen: number;
}

/** Splits `size` into `tileSize`-wide windows on a `stride` grid, each contributing exactly
 * `coreLen` pixels of trusted (non-overlap) output starting at `coreStart`, with no gaps and no
 * double-counted pixels. The last tile's core is short rather than the grid running past `size`. */
export function planAxis(size: number, stride: number): AxisTile[] {
  const numTiles = Math.max(1, Math.ceil(size / stride));
  return Array.from({ length: numTiles }, (_, i) => {
    const coreStart = i * stride;
    return { coreStart, coreLen: Math.min(stride, size - coreStart) };
  });
}

function hwcUint8ToChwFloat(tile: Buffer, size: number): Float32Array {
  const out = new Float32Array(3 * size * size);
  const plane = size * size;
  for (let i = 0; i < plane; i++) {
    const srcIdx = i * 3;
    out[i] = tile[srcIdx] / 255;
    out[plane + i] = tile[srcIdx + 1] / 255;
    out[2 * plane + i] = tile[srcIdx + 2] / 255;
  }
  return out;
}

function chwFloatToHwcUint8(data: Tensor['data'], size: number): Buffer {
  const floats = data as Float32Array;
  const out = Buffer.alloc(size * size * 3);
  const plane = size * size;
  for (let i = 0; i < plane; i++) {
    const dstIdx = i * 3;
    out[dstIdx] = clampByte(floats[i] * 255);
    out[dstIdx + 1] = clampByte(floats[plane + i] * 255);
    out[dstIdx + 2] = clampByte(floats[2 * plane + i] * 255);
  }
  return out;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function extractTile(
  padded: Buffer,
  paddedWidth: number,
  x: number,
  y: number,
  size: number
): Buffer {
  const tile = Buffer.alloc(size * size * 3);
  for (let row = 0; row < size; row++) {
    const srcStart = ((y + row) * paddedWidth + x) * 3;
    padded.copy(tile, row * size * 3, srcStart, srcStart + size * 3);
  }
  return tile;
}

function copyTileCore(
  src: Buffer,
  srcWidth: number,
  srcX: number,
  srcY: number,
  dst: Buffer,
  dstWidth: number,
  dstX: number,
  dstY: number,
  w: number,
  h: number
): void {
  for (let row = 0; row < h; row++) {
    const srcStart = ((srcY + row) * srcWidth + srcX) * 3;
    const dstStart = ((dstY + row) * dstWidth + dstX) * 3;
    src.copy(dst, dstStart, srcStart, srcStart + w * 3);
  }
}

/**
 * Runs `model` (a fixed `tileSize x tileSize` -> `tileSize*scale x tileSize*scale` ONNX graph --
 * see `models.ts`) over `rgb` in overlapping tiles, since the graph can't take an arbitrary image
 * size directly. `rgb` must already be plain RGB (no alpha -- see `pixels.ts`).
 */
export async function upscaleRgb(
  cacheRoot: string,
  model: UpscaleModel,
  rgb: RawPlane,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<RawPlane> {
  const session = await loadSession(cacheRoot, model);
  const { tileSize, overlap, scale, inputName, outputName } = model;
  const stride = tileSize - 2 * overlap;

  const xPlan = planAxis(rgb.width, stride);
  const yPlan = planAxis(rgb.height, stride);
  const paddedWidth = (xPlan.length - 1) * stride + tileSize;
  const paddedHeight = (yPlan.length - 1) * stride + tileSize;

  // Edge-replicate padding so every tile -- including ones hanging off the source image's right
  // and bottom edges -- gets a full `tileSize x tileSize` window with real (if repeated) context.
  const padded = await sharp(rgb.data, {
    raw: { width: rgb.width, height: rgb.height, channels: 3 }
  })
    .extend({
      top: overlap,
      left: overlap,
      bottom: paddedHeight - rgb.height - overlap,
      right: paddedWidth - rgb.width - overlap,
      extendWith: 'copy'
    })
    .raw()
    .toBuffer();

  const outWidth = rgb.width * scale;
  const outHeight = rgb.height * scale;
  const out = Buffer.alloc(outWidth * outHeight * 3);
  const total = xPlan.length * yPlan.length;
  let done = 0;

  for (const yTile of yPlan) {
    for (const xTile of xPlan) {
      if (signal?.aborted) throw new Error(UPSCALE_CANCELLED_MESSAGE);

      const tile = extractTile(padded, paddedWidth, xTile.coreStart, yTile.coreStart, tileSize);
      const inputTensor = new Tensor('float32', hwcUint8ToChwFloat(tile, tileSize), [
        1,
        3,
        tileSize,
        tileSize
      ]);
      const results = await session.run({ [inputName]: inputTensor });
      const outTileSize = tileSize * scale;
      const outTile = chwFloatToHwcUint8(results[outputName].data, outTileSize);

      copyTileCore(
        outTile,
        outTileSize,
        overlap * scale,
        overlap * scale,
        out,
        outWidth,
        xTile.coreStart * scale,
        yTile.coreStart * scale,
        xTile.coreLen * scale,
        yTile.coreLen * scale
      );

      done += 1;
      onProgress(done, total);
    }
  }

  return { data: out, width: outWidth, height: outHeight };
}
