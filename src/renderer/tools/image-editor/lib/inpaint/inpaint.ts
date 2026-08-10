import {
  cloneMaskedImage,
  downsample,
  isMasked,
  upscaleNearest,
  type MaskedImage
} from './maskedImage';
import {
  createNNF,
  forceIdentityLinks,
  minimizeNNF,
  randomizeNNF,
  seedFromOtherNNF,
  type NNF
} from './nnf';
import { buildSimilarityTable } from './similarity';

/**
 * EM-based multi-scale inpainting, ported from the algorithm in
 * github.com/younesse-cv/PatchMatch (itself an implementation of the inpainting application
 * described in Barnes et al., "PatchMatch: A Randomized Correspondence Algorithm for Structural
 * Image Editing", SIGGRAPH 2009), rewritten from scratch in TypeScript with flat typed-array data
 * structures throughout (the original's C uses a triple-nested-pointer array per NNF field and a
 * fresh malloc per pixel row, which doesn't translate well to a fast/low-memory port).
 *
 * The key difference from a naive single-direction PatchMatch (what this file used to be) is that
 * this maintains *two* nearest-neighbor fields -- source-to-target ("completeness": every known
 * patch should appear somewhere in the result) and target-to-source ("coherence": every result
 * patch should look like some known patch) -- and reconciles them via Expectation-Maximization
 * voting each round. Coherence is specifically what suppresses "locally plausible but structurally
 * wrong" matches (e.g. a patch of rock texture that's a fine color match but puts a mountain
 * ridgeline in the wrong place): a match that only the completeness field likes, but that nothing
 * coherently matches back, gets outvoted.
 */

const PATCH_RADIUS = 3;

export interface InpaintOptions {
  onProgress?: (done: number, total: number) => void;
  isCancelled?: () => boolean;
}

export interface InpaintResult {
  rgba: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

function buildPyramid(initial: MaskedImage, radius: number): MaskedImage[] {
  const pyramid = [initial];
  let current = initial;
  while (current.width > radius && current.height > radius) {
    current = downsample(current);
    pyramid.push(current);
  }
  return pyramid;
}

function weightedCopy(
  src: MaskedImage,
  sc: number,
  sr: number,
  voteR: Float32Array,
  voteG: Float32Array,
  voteB: Float32Array,
  voteW: Float32Array,
  voteWidth: number,
  voteHeight: number,
  tc: number,
  tr: number,
  w: number
): void {
  if (sc < 0 || sc >= src.width || sr < 0 || sr >= src.height) return;
  if (tc < 0 || tc >= voteWidth || tr < 0 || tr >= voteHeight) return;
  if (isMasked(src, sc, sr)) return;
  const si = (sr * src.width + sc) * 4;
  const ti = tr * voteWidth + tc;
  voteR[ti] += w * src.data[si];
  voteG[ti] += w * src.data[si + 1];
  voteB[ti] += w * src.data[si + 2];
  voteW[ti] += w;
}

/** Casts every vote a patch match is entitled to: for each pixel of `nnf.input`, its best match in
 * `nnf.output` votes (weighted by match quality) for every pixel value in the corresponding patch.
 * `valueSource` is where the actual color values are copied from -- normally the same image the
 * NNF was computed on, but on the last EM round of a level it's the *next, finer* pyramid level
 * (see `expectationMaximization`), so the vote injects real finer-resolution texture straight in
 * rather than upsampling the coarse level's own (softer) result. */
function expectationStep(
  nnf: NNF,
  sourceToTarget: boolean,
  voteR: Float32Array,
  voteG: Float32Array,
  voteB: Float32Array,
  voteW: Float32Array,
  voteWidth: number,
  voteHeight: number,
  valueSource: MaskedImage,
  upscale: boolean,
  similarity: Float64Array<ArrayBuffer>
): void {
  const { input, radius, fieldCol, fieldRow, fieldD } = nnf;
  const inW = input.width;
  const inH = input.height;

  for (let row = 0; row < inH; row++) {
    for (let col = 0; col < inW; col++) {
      const i = row * inW + col;
      const outCol = fieldCol[i];
      const outRow = fieldRow[i];
      const w = similarity[fieldD[i]];
      if (w <= 0) continue;

      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const sCol = sourceToTarget ? col + dc : outCol + dc;
          const sRow = sourceToTarget ? row + dr : outRow + dr;
          const tCol = sourceToTarget ? outCol + dc : col + dc;
          const tRow = sourceToTarget ? outRow + dr : row + dr;

          if (upscale) {
            weightedCopy(
              valueSource,
              2 * sCol,
              2 * sRow,
              voteR,
              voteG,
              voteB,
              voteW,
              voteWidth,
              voteHeight,
              2 * tCol,
              2 * tRow,
              w
            );
            weightedCopy(
              valueSource,
              2 * sCol + 1,
              2 * sRow,
              voteR,
              voteG,
              voteB,
              voteW,
              voteWidth,
              voteHeight,
              2 * tCol + 1,
              2 * tRow,
              w
            );
            weightedCopy(
              valueSource,
              2 * sCol,
              2 * sRow + 1,
              voteR,
              voteG,
              voteB,
              voteW,
              voteWidth,
              voteHeight,
              2 * tCol,
              2 * tRow + 1,
              w
            );
            weightedCopy(
              valueSource,
              2 * sCol + 1,
              2 * sRow + 1,
              voteR,
              voteG,
              voteB,
              voteW,
              voteWidth,
              voteHeight,
              2 * tCol + 1,
              2 * tRow + 1,
              w
            );
          } else {
            weightedCopy(
              valueSource,
              sCol,
              sRow,
              voteR,
              voteG,
              voteB,
              voteW,
              voteWidth,
              voteHeight,
              tCol,
              tRow,
              w
            );
          }
        }
      }
    }
  }
}

function maximizationStep(
  target: MaskedImage,
  voteR: Float32Array,
  voteG: Float32Array,
  voteB: Float32Array,
  voteW: Float32Array
): void {
  const { width, height, data, mask } = target;
  for (let i = 0; i < width * height; i++) {
    if (voteW[i] > 0) {
      const base = i * 4;
      data[base] = voteR[i] / voteW[i];
      data[base + 1] = voteG[i] / voteW[i];
      data[base + 2] = voteB[i] / voteW[i];
      data[base + 3] = 255;
      mask[i] = 0;
    }
  }
}

async function expectationMaximization(
  pyramid: MaskedImage[],
  level: number,
  nnfSourceToTarget: NNF,
  nnfTargetToSource: NNF,
  similarity: Float64Array<ArrayBuffer>,
  onIterationDone: (() => void) | undefined,
  isCancelled: (() => boolean) | undefined
): Promise<MaskedImage> {
  const iterEM = 1 + 2 * level;
  const iterNNF = Math.min(7, 1 + level);
  const source = nnfSourceToTarget.input;
  let target = nnfSourceToTarget.output;
  let newTarget: MaskedImage | null = null;

  for (let em = 1; em <= iterEM; em++) {
    if (isCancelled?.()) return newTarget ?? target;

    if (newTarget) {
      nnfSourceToTarget.output = newTarget;
      nnfTargetToSource.input = newTarget;
      target = newTarget;
      newTarget = null;
    }

    // Known content doesn't need refining -- pin it to itself so search effort goes toward the
    // hole, and so refinement never accidentally drifts a known patch away from its true position.
    forceIdentityLinks(nnfSourceToTarget, source);
    forceIdentityLinks(nnfTargetToSource, source);

    minimizeNNF(nnfSourceToTarget, iterNNF);
    minimizeNNF(nnfTargetToSource, iterNNF);

    let upscale = false;
    let valueSource: MaskedImage;
    let outWidth: number;
    let outHeight: number;
    // On the last EM round of a non-finest level, build the next target directly at the *next,
    // finer* pyramid resolution instead of upsizing this level's own (softer) result -- see
    // "Space-Time Video Completion" (Wexler et al.) for why this materially reduces blur.
    if (level >= 1 && em === iterEM) {
      valueSource = pyramid[level - 1];
      outWidth = valueSource.width;
      outHeight = valueSource.height;
      newTarget = upscaleNearest(target, outWidth, outHeight);
      upscale = true;
    } else {
      valueSource = pyramid[level];
      outWidth = target.width;
      outHeight = target.height;
      newTarget = cloneMaskedImage(target);
    }

    const size = outWidth * outHeight;
    const voteR = new Float32Array(size);
    const voteG = new Float32Array(size);
    const voteB = new Float32Array(size);
    const voteW = new Float32Array(size);

    // Completeness: every known patch should be used somewhere.
    expectationStep(
      nnfSourceToTarget,
      true,
      voteR,
      voteG,
      voteB,
      voteW,
      outWidth,
      outHeight,
      valueSource,
      upscale,
      similarity
    );
    // Coherence: every result patch should look like some known patch.
    expectationStep(
      nnfTargetToSource,
      false,
      voteR,
      voteG,
      voteB,
      voteW,
      outWidth,
      outHeight,
      valueSource,
      upscale,
      similarity
    );
    maximizationStep(newTarget, voteR, voteG, voteB, voteW);

    onIterationDone?.();
    await yieldToEventLoop();
  }

  return newTarget ?? target;
}

/**
 * Fills every hole pixel (`mask[i] !== 0`) with synthesized texture, via multi-scale EM-refined
 * PatchMatch (see the module doc above). Returns `null` if cancelled partway through.
 */
export async function inpaint(
  rgba: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  mask: Uint8Array<ArrayBuffer>,
  options: InpaintOptions = {}
): Promise<InpaintResult | null> {
  const { onProgress, isCancelled } = options;
  const radius = PATCH_RADIUS;
  const similarity = buildSimilarityTable();

  const initial: MaskedImage = {
    width,
    height,
    data: new Uint8ClampedArray(rgba),
    mask: new Uint8Array(mask)
  };
  const pyramid = buildPyramid(initial, radius);
  const maxLevel = pyramid.length;

  let totalSteps = 0;
  for (let level = maxLevel - 1; level >= 1; level--) totalSteps += 1 + 2 * level;
  let doneSteps = 0;

  let target: MaskedImage | null = null;
  let nnfSourceToTarget: NNF | null = null;
  let nnfTargetToSource: NNF | null = null;

  for (let level = maxLevel - 1; level >= 1; level--) {
    if (isCancelled?.()) return null;
    const source = pyramid[level];

    if (level === maxLevel - 1) {
      // Coarsest level: start from an unconstrained random guess. The working target is a copy of
      // the source with its mask cleared -- not because the hole is actually filled yet (it isn't;
      // those pixels' color values are still garbage), but because at this level "known" vs "hole"
      // is irrelevant for search purposes: EM voting will overwrite every pixel from real content
      // within the first round regardless.
      target = cloneMaskedImage(source);
      target.mask.fill(0);
      nnfSourceToTarget = createNNF(source, target, radius);
      randomizeNNF(nnfSourceToTarget);
      nnfTargetToSource = createNNF(target, source, radius);
      randomizeNNF(nnfTargetToSource);
    } else {
      const newNnfSourceToTarget = createNNF(source, target!, radius);
      seedFromOtherNNF(newNnfSourceToTarget, nnfSourceToTarget!);
      nnfSourceToTarget = newNnfSourceToTarget;
      const newNnfTargetToSource = createNNF(target!, source, radius);
      seedFromOtherNNF(newNnfTargetToSource, nnfTargetToSource!);
      nnfTargetToSource = newNnfTargetToSource;
    }

    target = await expectationMaximization(
      pyramid,
      level,
      nnfSourceToTarget,
      nnfTargetToSource,
      similarity,
      () => {
        doneSteps++;
        onProgress?.(doneSteps, totalSteps);
      },
      isCancelled
    );
  }

  if (isCancelled?.()) return null;

  // Degenerate case: the image is already too small (<= radius in either dimension) for the
  // pyramid to have more than one level, so the EM loop above never runs. Nothing sensible to
  // synthesize at that size -- return the input untouched.
  if (!target) return { rgba: initial.data, width: initial.width, height: initial.height };

  return { rgba: target.data, width: target.width, height: target.height };
}
