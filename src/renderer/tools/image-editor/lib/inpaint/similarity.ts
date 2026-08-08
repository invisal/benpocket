/** The maximum value a scaled patch distance can take (see `patchDistance` in `maskedImage.ts`). */
export const DSCALE = 65535;

/** Hand-picked samples of the similarity curve, ported from the reference inpainting
 * implementation this module is based on (github.com/younesse-cv/PatchMatch): similarity falls
 * off steeply as distance grows, and hits exactly zero well before the distance range is
 * exhausted. That's deliberate -- during EM voting (see `inpaintCore.ts`), a mediocre-or-worse
 * match should contribute nothing rather than dragging a good match's average down. */
const SIMILARITY_BASE = [1.0, 0.99, 0.96, 0.83, 0.38, 0.11, 0.02, 0.005, 0.0006, 0.0001, 0];

/** Builds a lookup table mapping every possible scaled patch distance (0..DSCALE) to a voting
 * weight in [0, 1], by linearly interpolating between the hand-picked samples above. */
export function buildSimilarityTable(): Float64Array<ArrayBuffer> {
  const length = DSCALE + 1;
  const table = new Float64Array(length);
  for (let i = 0; i < length; i++) {
    const t = i / length;
    const j = Math.floor(100 * t);
    const k = j + 1;
    const vj = j < SIMILARITY_BASE.length ? SIMILARITY_BASE[j] : 0;
    const vk = k < SIMILARITY_BASE.length ? SIMILARITY_BASE[k] : 0;
    table[i] = vj + (100 * t - j) * (vk - vj);
  }
  return table;
}
