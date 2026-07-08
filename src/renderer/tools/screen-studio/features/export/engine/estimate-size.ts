import type { ExportCodec } from '@screen-studio/types/export';

export interface EstimateSizeInput {
  originalSizeBytes: number;
  durationSeconds: number;
  resolution: { width: number; height: number };
  frameRate: number;
  codec: ExportCodec;
  /** 0-100, see features/export/presets.ts's qualityLabel bands. */
  quality: number;
}

export interface EstimateSizeResult {
  estimatedBytes: number;
  bitrateMbps: number;
  reductionPercent: number;
}

// NOTE: this is a rough, client-side heuristic for the "estimated output"
// panel -- it is NOT a real encoder pass. Once main/export/export-manager.ts
// actually pipes frames through ffmpeg, replace this with either a two-pass
// ffprobe estimate or the real output size after encoding.
const CODEC_EFFICIENCY: Record<ExportCodec, number> = {
  h264: 1,
  h265: 0.65,
  av1: 0.5
};

const REFERENCE_PIXELS = 1920 * 1080;
const REFERENCE_BITRATE_MBPS = 8;

export function estimateExportSize(input: EstimateSizeInput): EstimateSizeResult {
  const pixelRatio = (input.resolution.width * input.resolution.height) / REFERENCE_PIXELS;
  const frameRatio = input.frameRate / 30;
  const qualityFactor = 0.35 + (input.quality / 100) * 1.35;
  const codecFactor = CODEC_EFFICIENCY[input.codec];

  const bitrateMbps =
    REFERENCE_BITRATE_MBPS * pixelRatio * frameRatio * qualityFactor * codecFactor;
  const estimatedBytes = ((bitrateMbps * 1_000_000) / 8) * input.durationSeconds;

  const reductionPercent =
    input.originalSizeBytes > 0
      ? Math.max(0, Math.round((1 - estimatedBytes / input.originalSizeBytes) * 100))
      : 0;

  return { estimatedBytes, bitrateMbps, reductionPercent };
}
