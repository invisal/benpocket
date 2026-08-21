import type { ExportFormat } from '@screen-recorder/types/export';
import { computeBitrate } from '../engine/video-encoder';
import { AUDIO_BITRATE } from '../engine/audio-encoder';

export interface ExportEstimate {
  fileSizeBytes: number;
  timeSeconds: number;
}

/** Blend weight for each new real-export sample folded into the running size-calibration ratio (see `blendSizeCalibrationRatio`) -- moderate: adapts to a shift in typical content within a few exports without letting one outlier swing it too far. Not used for the very first sample, which fully replaces the placeholder ratio instead (see that function's own doc). */
const CALIBRATION_EMA_ALPHA = 0.3;
/**
 * Bounds the learned ratio can ever reach -- a single degenerate sample
 * (e.g. a near-zero-duration export) can't send future size estimates to
 * something absurd. Wide on the low end since real screen-recording content
 * can be extremely compressible (near-static screen, VBR) -- much more so
 * than the formula's bits-per-pixel heuristic (tuned closer to typical
 * camera-recorded video) assumes.
 */
const MIN_CALIBRATION_RATIO = 0.05;
const MAX_CALIBRATION_RATIO = 1.5;

/**
 * Folds one real export's actual-vs-predicted size into a running
 * calibration ratio (see export-store.ts's `sizeCalibrationRatio` /
 * `recordActualExportSize`) and clamps to a sane range. Pure so it's
 * directly testable without the store's `persist` middleware (which needs a
 * real `localStorage`) in the loop -- the store action is a thin wrapper
 * that just reads/writes `sizeCalibrationRatio` around this.
 *
 * `hasPriorSample` (see export-store.ts's `hasSizeCalibrationSample`)
 * distinguishes "never actually calibrated" from "calibrated to exactly
 * 1.0" -- `currentRatio` starts at the placeholder `1` before any real
 * export has happened, which isn't a belief about this user's content, just
 * "trust the raw formula for lack of anything better." Blending the first
 * real sample only `CALIBRATION_EMA_ALPHA` of the way there against that
 * meaningless placeholder would leave the estimate mostly wrong right after
 * the very export that was supposed to fix it. So the first sample fully
 * replaces the ratio instead; only the *second* and later samples blend
 * against an actual prior belief.
 */
export function blendSizeCalibrationRatio(
  currentRatio: number,
  hasPriorSample: boolean,
  rawEstimatedBytes: number,
  actualBytes: number
): number {
  if (rawEstimatedBytes <= 0 || actualBytes <= 0) return currentRatio;
  const sampleRatio = actualBytes / rawEstimatedBytes;
  const blended = hasPriorSample
    ? currentRatio * (1 - CALIBRATION_EMA_ALPHA) + sampleRatio * CALIBRATION_EMA_ALPHA
    : sampleRatio;
  return Math.min(MAX_CALIBRATION_RATIO, Math.max(MIN_CALIBRATION_RATIO, blended));
}

interface EstimateExportOptions {
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
  quality: number;
  includeAudio: boolean;
  format: ExportFormat;
  hasWebcam: boolean;
}

/**
 * File-size estimate straight from the configured bitrate (video-encoder.ts's
 * `computeBitrate`) times duration, plus a fixed audio bitrate when
 * included -- exported separately from `estimateExport` so a real export's
 * actual output size can be compared against exactly this *uncalibrated*
 * number to produce a fresh calibration sample (see export-store.ts's
 * `recordActualExportSize`), without that comparison being skewed by
 * whatever calibration was already applied to a previous estimate.
 */
export function estimateRawExportBytes(options: EstimateExportOptions): number {
  const durationSec = options.durationMs / 1000;
  const videoBitrate = computeBitrate(
    options.width,
    options.height,
    options.frameRate,
    options.quality,
    options.hasWebcam
  );
  const audioBitrate = options.includeAudio && options.format !== 'gif' ? AUDIO_BITRATE : 0;
  return ((videoBitrate + audioBitrate) / 8) * durationSec;
}

/**
 * Rough client-side estimate for the export summary, not a guarantee --
 * there's no way to know actual encoder throughput ahead of time. The real
 * video encoder uses VBR (video-encoder.ts's `bitrateMode: 'variable'`), so
 * the configured bitrate `estimateRawExportBytes` multiplies out is only a
 * target/ceiling -- low-motion screen-recording content typically lands
 * well under it, by an amount that varies with content. `calibrationRatio`
 * (see export-store.ts's `sizeCalibrationRatio`, learned from this user's
 * own past exports rather than a guessed constant) corrects for that gap;
 * pass `1` (or omit it) to get the raw formula-only number.
 *
 * Time assumes roughly real-time encoding, scaled up for heavier frames
 * (more pixels/quality = more work per frame) since that's the only signal
 * available without actually running the encoder -- not corrected by
 * `calibrationRatio`, which only reflects file-size behavior.
 */
export function estimateExport(
  options: EstimateExportOptions,
  calibrationRatio = 1
): ExportEstimate {
  const durationSec = options.durationMs / 1000;
  const fileSizeBytes = estimateRawExportBytes(options) * calibrationRatio;

  const pixelCount = options.width * options.height;
  const speedFactor =
    pixelCount > 3840 * 2160 * 0.9 ? 1.4 : pixelCount > 1920 * 1080 * 0.9 ? 1 : 0.6;
  const timeSeconds = Math.max(1, Math.round(durationSec * speedFactor));

  return { fileSizeBytes, timeSeconds };
}
