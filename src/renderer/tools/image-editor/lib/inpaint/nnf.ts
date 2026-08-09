import { containsMasked, patchDistance, type MaskedImage } from './maskedImage';
import { DSCALE } from './similarity';

/** A Nearest-Neighbor Field: for every pixel of `input`, the best-matching patch found so far in
 * `output` (as a col/row pair) and its scaled distance. `fieldD === 0` marks a pixel that's been
 * pinned to itself (see `forceIdentityLinks`) rather than actually searched. */
export interface NNF {
  input: MaskedImage;
  output: MaskedImage;
  radius: number;
  fieldCol: Int32Array<ArrayBuffer>;
  fieldRow: Int32Array<ArrayBuffer>;
  fieldD: Int32Array<ArrayBuffer>;
}

export function createNNF(input: MaskedImage, output: MaskedImage, radius: number): NNF {
  const size = input.width * input.height;
  return {
    input,
    output,
    radius,
    fieldCol: new Int32Array(size),
    fieldRow: new Int32Array(size),
    fieldD: new Int32Array(size).fill(DSCALE)
  };
}

function distanceAt(nnf: NNF, col: number, row: number, outCol: number, outRow: number): number {
  return patchDistance(nnf.input, col, row, nnf.output, outCol, outRow, nnf.radius);
}

function resolveInitialDistances(nnf: NNF): void {
  const { input, output, fieldCol, fieldRow, fieldD } = nnf;
  const maxRetry = 20;
  for (let row = 0; row < input.height; row++) {
    for (let col = 0; col < input.width; col++) {
      const i = row * input.width + col;
      let d = distanceAt(nnf, col, row, fieldCol[i], fieldRow[i]);
      let tries = 0;
      // A distance of exactly DSCALE almost always means the candidate patch was entirely masked
      // (see `patchDistance`) -- worth a few retries with a fresh random guess rather than keeping
      // a link that's guaranteed useless.
      while (d === DSCALE && tries < maxRetry) {
        fieldCol[i] = Math.floor(Math.random() * output.width);
        fieldRow[i] = Math.floor(Math.random() * output.height);
        d = distanceAt(nnf, col, row, fieldCol[i], fieldRow[i]);
        tries++;
      }
      fieldD[i] = d;
    }
  }
}

export function randomizeNNF(nnf: NNF): void {
  const { input, output, fieldCol, fieldRow } = nnf;
  for (let row = 0; row < input.height; row++) {
    for (let col = 0; col < input.width; col++) {
      const i = row * input.width + col;
      fieldCol[i] = Math.floor(Math.random() * output.width);
      fieldRow[i] = Math.floor(Math.random() * output.height);
    }
  }
  resolveInitialDistances(nnf);
}

/** Seeds `nnf` from a previously-converged NNF at a coarser (or equal) resolution -- scales
 * offsets by the resolution ratio rather than starting the search over, carrying the coarser
 * level's structural decisions forward as a head start for this level's refinement. */
export function seedFromOtherNNF(nnf: NNF, other: NNF): void {
  const { input, fieldCol, fieldRow } = nnf;
  const scaleX = Math.max(1, Math.floor(input.width / other.input.width));
  const scaleY = Math.max(1, Math.floor(input.height / other.input.height));
  for (let row = 0; row < input.height; row++) {
    const otherRow = Math.min(Math.floor(row / scaleY), other.input.height - 1);
    for (let col = 0; col < input.width; col++) {
      const otherCol = Math.min(Math.floor(col / scaleX), other.input.width - 1);
      const oi = otherRow * other.input.width + otherCol;
      const i = row * input.width + col;
      fieldCol[i] = other.fieldCol[oi] * scaleX;
      fieldRow[i] = other.fieldRow[oi] * scaleY;
    }
  }
  resolveInitialDistances(nnf);
}

/** Pins every pixel whose (2*radius+1) neighborhood in `reference` is entirely known content to
 * map to itself at zero distance. There's no point spending search budget re-discovering that a
 * patch deep in known territory is its own best match -- and pinning it stops the coarser-to-finer
 * refinement from ever accidentally drifting known content away from itself. */
export function forceIdentityLinks(nnf: NNF, reference: MaskedImage): void {
  const { input, radius, fieldCol, fieldRow, fieldD } = nnf;
  for (let row = 0; row < input.height; row++) {
    for (let col = 0; col < input.width; col++) {
      if (!containsMasked(reference, col, row, radius)) {
        const i = row * input.width + col;
        fieldCol[i] = col;
        fieldRow[i] = row;
        fieldD[i] = 0;
      }
    }
  }
}

const RANDOM_SEARCH_ALPHA = 0.5;

function tryUpdate(
  nnf: NNF,
  i: number,
  col: number,
  row: number,
  candCol: number,
  candRow: number
): void {
  const { output, fieldCol, fieldRow, fieldD } = nnf;
  if (candCol < 0 || candCol >= output.width || candRow < 0 || candRow >= output.height) return;
  const d = distanceAt(nnf, col, row, candCol, candRow);
  if (d < fieldD[i]) {
    fieldD[i] = d;
    fieldCol[i] = candCol;
    fieldRow[i] = candRow;
  }
}

function minimizeLink(nnf: NNF, col: number, row: number, dir: 1 | -1): void {
  const { input, output, fieldCol, fieldRow } = nnf;
  const i = row * input.width + col;

  // Propagation along rows: steal the match of the neighbor we just refined (one row back, in
  // scan direction `dir`), shifted by one row -- if that neighbor's patch is a good match, the
  // patch one row over from it usually is too.
  const nRow = row - dir;
  if (nRow >= 0 && nRow < input.height) {
    const ni = nRow * input.width + col;
    tryUpdate(nnf, i, col, row, fieldCol[ni], fieldRow[ni] + dir);
  }
  // Propagation along columns: same idea, one column back.
  const nCol = col - dir;
  if (nCol >= 0 && nCol < input.width) {
    const ni = row * input.width + nCol;
    tryUpdate(nnf, i, col, row, fieldCol[ni] + dir, fieldRow[ni]);
  }

  // Random search at a shrinking window around the current best match, to escape local optima
  // propagation alone can't reach.
  let w = output.width;
  const bestCol = fieldCol[i];
  const bestRow = fieldRow[i];
  while (w >= 1) {
    const candCol = Math.max(
      0,
      Math.min(output.width - 1, bestCol + Math.floor(Math.random() * (2 * w) - w))
    );
    const candRow = Math.max(
      0,
      Math.min(output.height - 1, bestRow + Math.floor(Math.random() * (2 * w) - w))
    );
    tryUpdate(nnf, i, col, row, candCol, candRow);
    w = Math.floor(w * RANDOM_SEARCH_ALPHA);
  }
}

/** Multi-pass NNF minimization: alternating forward and reverse raster-scan passes, each
 * combining propagation with a random search. Pixels already pinned to zero distance (see
 * `forceIdentityLinks`) are skipped -- nothing to improve on a perfect self-match. */
export function minimizeNNF(nnf: NNF, passes: number): void {
  const { input, fieldD } = nnf;
  for (let p = 0; p < passes; p++) {
    for (let row = 0; row < input.height; row++) {
      for (let col = 0; col < input.width; col++) {
        if (fieldD[row * input.width + col] > 0) minimizeLink(nnf, col, row, 1);
      }
    }
    for (let row = input.height - 1; row >= 0; row--) {
      for (let col = input.width - 1; col >= 0; col--) {
        if (fieldD[row * input.width + col] > 0) minimizeLink(nnf, col, row, -1);
      }
    }
  }
}
