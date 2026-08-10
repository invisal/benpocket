// FLUX.2 [klein] accepts width/height in [256, 1920]. Keeping the requested area close to the
// model's own square default (1024x1024 = ~1.05M px) keeps generation cost/latency roughly
// constant no matter what aspect ratio gets requested.
export const MIN_DIMENSION = 256;
export const MAX_DIMENSION = 1920;
const TARGET_PIXELS = 1024 * 1024;
// Diffusion models decode at a fixed latent downscale factor, so dimensions that aren't a
// multiple of it can get silently rounded or rejected by the model -- round to a safely
// conservative multiple rather than send the raw sqrt() result.
const ROUNDING = 32;

function roundToMultiple(value: number, multiple: number): number {
  return Math.round(value / multiple) * multiple;
}

function clampDimension(value: number): number {
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, roundToMultiple(value, ROUNDING)));
}

/**
 * Picks a generation width/height matching `width`/`height`'s aspect ratio while holding the
 * total pixel count close to `TARGET_PIXELS`, clamped to what the model accepts. Used so a
 * generation/edit comes back already shaped like the image it's replacing, instead of always
 * getting the model's square default and having to stretch or crop it into shape afterward.
 */
export function computeGenerationSize(
  width: number,
  height: number
): { width: number; height: number } {
  const aspect = width / height;
  const rawWidth = Math.sqrt(TARGET_PIXELS * aspect);
  const rawHeight = Math.sqrt(TARGET_PIXELS / aspect);

  return { width: clampDimension(rawWidth), height: clampDimension(rawHeight) };
}
