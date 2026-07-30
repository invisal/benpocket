import type { ExportFormat } from '@screen-recorder/types/export';
import { computeBitrate } from '../engine/video-encoder';
import { AUDIO_BITRATE } from '../engine/audio-encoder';

export interface ExportEstimate {
  fileSizeBytes: number;
  timeSeconds: number;
}

interface EstimateExportOptions {
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
  quality: number;
  includeAudio: boolean;
  format: ExportFormat;
}

/**
 * Rough client-side estimate for the export summary, not a guarantee --
 * there's no way to know actual encoder throughput ahead of time. File size
 * reuses the exact bitrate formula the real video encoder uses
 * (video-encoder.ts's `computeBitrate`) times duration, plus a fixed audio
 * bitrate when included. Time assumes roughly real-time encoding, scaled up
 * for heavier frames (more pixels/quality = more work per frame) since
 * that's the only signal available without actually running the encoder.
 */
export function estimateExport(options: EstimateExportOptions): ExportEstimate {
  const durationSec = options.durationMs / 1000;
  const videoBitrate = computeBitrate(
    options.width,
    options.height,
    options.frameRate,
    options.quality
  );
  const audioBitrate = options.includeAudio && options.format !== 'gif' ? AUDIO_BITRATE : 0;
  const fileSizeBytes = ((videoBitrate + audioBitrate) / 8) * durationSec;

  const pixelCount = options.width * options.height;
  const speedFactor =
    pixelCount > 3840 * 2160 * 0.9 ? 1.4 : pixelCount > 1920 * 1080 * 0.9 ? 1 : 0.6;
  const timeSeconds = Math.max(1, Math.round(durationSec * speedFactor));

  return { fileSizeBytes, timeSeconds };
}
