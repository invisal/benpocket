import { DSCALE } from './similarity';

/** An RGBA image paired with a hole mask, addressed as (col, row) -- col in [0, width), row in
 * [0, height), flat index = row * width + col. This is the unit of work throughout the inpainting
 * pyramid: every pyramid level, and both the "source" and "target" side of a nearest-neighbor
 * field, is one of these. */
export interface MaskedImage {
  width: number;
  height: number;
  /** RGBA, 4 bytes/pixel. Alpha is always 255 -- inpainting never touches transparency. */
  data: Uint8ClampedArray<ArrayBuffer>;
  /** 0 = known pixel, non-zero = hole (needs to be synthesized). */
  mask: Uint8Array<ArrayBuffer>;
}

export function createMaskedImage(width: number, height: number): MaskedImage {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
    mask: new Uint8Array(width * height)
  };
}

export function cloneMaskedImage(img: MaskedImage): MaskedImage {
  return {
    width: img.width,
    height: img.height,
    data: new Uint8ClampedArray(img.data),
    mask: new Uint8Array(img.mask)
  };
}

export function isMasked(img: MaskedImage, col: number, row: number): boolean {
  return img.mask[row * img.width + col] !== 0;
}

export function setMasked(img: MaskedImage, col: number, row: number, value: boolean): void {
  img.mask[row * img.width + col] = value ? 1 : 0;
}

/** True if any pixel in the (2*radius+1) box centered at (col,row) is a hole -- used to decide
 * whether a patch is safe to treat as "fully known" content. */
export function containsMasked(
  img: MaskedImage,
  col: number,
  row: number,
  radius: number
): boolean {
  const { width, height, mask } = img;
  for (let dr = -radius; dr <= radius; dr++) {
    const r = row + dr;
    if (r < 0 || r >= height) continue;
    const base = r * width;
    for (let dc = -radius; dc <= radius; dc++) {
      const c = col + dc;
      if (c < 0 || c >= width) continue;
      if (mask[base + c] !== 0) return true;
    }
  }
  return false;
}

const SSD_MAX = 9 * 255 * 255;

/**
 * Patch distance between a patch centered at (sc,sr) in `source` and a patch centered at (tc,tr)
 * in `target`: sum of squared differences in color value *and* horizontal/vertical gradient per
 * channel. The gradient terms are what make this structure-aware rather than purely color-aware --
 * two patches with the same average color but a different edge direction (e.g. a ridgeline going
 * the "wrong way") score as dissimilar, which is exactly the failure mode plain SSD color matching
 * doesn't catch. A patch pixel that's masked, or within 1px of either image's border (gradients
 * need a neighbor on both sides), contributes the maximum per-pixel penalty rather than being
 * skipped -- same convention as the reference algorithm this is ported from. Returns an integer
 * scaled to [0, DSCALE]. `bestSoFar` (also DSCALE-scaled) lets the caller bail out once the match
 * can no longer beat the current best, without waiting for the full patch to be scored.
 */
export function patchDistance(
  source: MaskedImage,
  sc: number,
  sr: number,
  target: MaskedImage,
  tc: number,
  tr: number,
  radius: number,
  bestSoFar: number = DSCALE
): number {
  const patchPixels = (2 * radius + 1) * (2 * radius + 1);
  const budgetUnits = (bestSoFar * patchPixels) / DSCALE;
  let distance = 0;

  for (let dr = -radius; dr <= radius; dr++) {
    const sRow = sr + dr;
    const tRow = tr + dr;
    for (let dc = -radius; dc <= radius; dc++) {
      const sCol = sc + dc;
      const tCol = tc + dc;

      if (
        sRow < 1 ||
        sRow >= source.height - 1 ||
        sCol < 1 ||
        sCol >= source.width - 1 ||
        isMasked(source, sCol, sRow) ||
        tRow < 1 ||
        tRow >= target.height - 1 ||
        tCol < 1 ||
        tCol >= target.width - 1 ||
        isMasked(target, tCol, tRow)
      ) {
        distance += 1;
        continue;
      }

      const sBase = (sRow * source.width + sCol) * 4;
      const tBase = (tRow * target.width + tCol) * 4;
      const sBaseXp = sBase + 4;
      const sBaseXm = sBase - 4;
      const sBaseYp = sBase + source.width * 4;
      const sBaseYm = sBase - source.width * 4;
      const tBaseXp = tBase + 4;
      const tBaseXm = tBase - 4;
      const tBaseYp = tBase + target.width * 4;
      const tBaseYm = tBase - target.width * 4;

      let ssd = 0;
      for (let band = 0; band < 3; band++) {
        const dv = source.data[sBase + band] - target.data[tBase + band];
        const sGx = source.data[sBaseXp + band] - source.data[sBaseXm + band];
        const tGx = target.data[tBaseXp + band] - target.data[tBaseXm + band];
        const sGy = source.data[sBaseYp + band] - source.data[sBaseYm + band];
        const tGy = target.data[tBaseYp + band] - target.data[tBaseYm + band];
        const dgx = (sGx - tGx) / 2;
        const dgy = (sGy - tGy) / 2;
        ssd += dv * dv + dgx * dgx + dgy * dgy;
      }
      distance += ssd / SSD_MAX;
    }
    if (distance >= budgetUnits) return bestSoFar;
  }

  const res = Math.round((DSCALE * distance) / patchPixels);
  return res < 0 ? 0 : res > DSCALE ? DSCALE : res;
}

const DOWNSAMPLE_KERNEL = [1, 5, 10, 10, 5, 1];

/** Halves resolution with a 6-tap binomial-ish blur, skipping masked source pixels in the
 * weighted average (so a hole doesn't bleed a fake "average color" into the downsampled level --
 * a destination pixel with no unmasked contributors at all is itself marked as a hole). */
export function downsample(source: MaskedImage): MaskedImage {
  const { width, height } = source;
  const newWidth = Math.floor(width / 2);
  const newHeight = Math.floor(height / 2);
  const out = createMaskedImage(newWidth, newHeight);

  for (let row = 0; row < height - 1; row += 2) {
    const outRow = row / 2;
    if (outRow >= newHeight) continue;
    for (let col = 0; col < width - 1; col += 2) {
      const outCol = col / 2;
      if (outCol >= newWidth) continue;

      let r = 0;
      let g = 0;
      let b = 0;
      let weightSum = 0;
      let contributors = 0;
      for (let dr = -2; dr <= 3; dr++) {
        const sr = row + dr;
        if (sr < 0 || sr >= height) continue;
        const kr = DOWNSAMPLE_KERNEL[2 + dr];
        for (let dc = -2; dc <= 3; dc++) {
          const sc = col + dc;
          if (sc < 0 || sc >= width) continue;
          if (isMasked(source, sc, sr)) continue;
          const k = DOWNSAMPLE_KERNEL[2 + dc] * kr;
          const base = (sr * width + sc) * 4;
          r += k * source.data[base];
          g += k * source.data[base + 1];
          b += k * source.data[base + 2];
          weightSum += k;
          contributors++;
        }
      }

      const outBase = (outRow * newWidth + outCol) * 4;
      if (contributors > 0 && weightSum > 0) {
        out.data[outBase] = r / weightSum;
        out.data[outBase + 1] = g / weightSum;
        out.data[outBase + 2] = b / weightSum;
        out.data[outBase + 3] = 255;
        setMasked(out, outCol, outRow, false);
      } else {
        setMasked(out, outCol, outRow, true);
      }
    }
  }
  return out;
}

/** Nearest-neighbor upscale to an arbitrary target size. Deliberately not bilinear: this is used
 * mid-algorithm to carry a coarse level's result forward as a starting point for further EM
 * refinement (see `inpaintCore.ts`), not as the final output, so there's nothing to gain from
 * smoothing it -- and nearest-neighbor keeps masked/unmasked status unambiguous per pixel. */
export function upscaleNearest(
  source: MaskedImage,
  newWidth: number,
  newHeight: number
): MaskedImage {
  const out = createMaskedImage(newWidth, newHeight);
  const { width, height } = source;
  for (let row = 0; row < newHeight; row++) {
    const sr = Math.floor((row * height) / newHeight);
    for (let col = 0; col < newWidth; col++) {
      const sc = Math.floor((col * width) / newWidth);
      const outBase = (row * newWidth + col) * 4;
      if (!isMasked(source, sc, sr)) {
        const srcBase = (sr * width + sc) * 4;
        out.data[outBase] = source.data[srcBase];
        out.data[outBase + 1] = source.data[srcBase + 1];
        out.data[outBase + 2] = source.data[srcBase + 2];
        out.data[outBase + 3] = 255;
        setMasked(out, col, row, false);
      } else {
        setMasked(out, col, row, true);
      }
    }
  }
  return out;
}
