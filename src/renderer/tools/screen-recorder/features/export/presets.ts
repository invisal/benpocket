import type { ExportCodec, ExportFormat } from '@screen-recorder/types/export';
import { isLikelyLinux } from '../../lib/platform';

export interface ExportPreset {
  id: string;
  label: string;
  description: string;
  format: ExportFormat;
  codec: ExportCodec;
  resolution: { width: number; height: number; label: string };
  frameRate: number;
  quality: number;
}

// H.265 has no software encoder at all in Chromium (see video-encoder.ts's
// getEncoderPreferences doc) and hardware HEVC encode support on Linux is far
// less consistently available than VideoToolbox (macOS) / Media Foundation
// (Windows) -- confirmed directly: on a Linux box without a working hardware
// encoder, an h265 export fails with no possible fallback, while h264 always
// has one (OpenH264, bundled). Every preset below that would otherwise
// default to h265 uses this instead, so "Export" reliably produces a file on
// Linux rather than deterministically failing on presets that work fine
// elsewhere.
const highEfficiencyCodec: { codec: ExportCodec; label: string } = isLikelyLinux
  ? { codec: 'h264', label: 'H.264' }
  : { codec: 'h265', label: 'H.265' };

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'web',
    label: 'Web',
    description: `1080p · ${highEfficiencyCodec.label}`,
    format: 'mp4',
    codec: highEfficiencyCodec.codec,
    resolution: { width: 1920, height: 1080, label: '1080p' },
    frameRate: 30,
    quality: 46
  },
  {
    id: 'social',
    label: 'Social',
    description: '1080p · H.264',
    format: 'mp4',
    codec: 'h264',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    frameRate: 30,
    quality: 60
  },
  {
    id: 'email',
    label: 'Email',
    description: '720p · light',
    format: 'mp4',
    codec: highEfficiencyCodec.codec,
    resolution: { width: 1280, height: 720, label: '720p' },
    frameRate: 30,
    quality: 25
  },
  {
    id: '4k-master',
    label: '4K Master',
    description: '2160p · 60fps',
    format: 'mov',
    codec: 'h264',
    resolution: { width: 3840, height: 2160, label: '2160p' },
    frameRate: 60,
    quality: 90
  },
  {
    id: 'gif',
    label: 'GIF',
    description: '480p · loop',
    format: 'gif',
    codec: 'h264',
    resolution: { width: 854, height: 480, label: '480p' },
    frameRate: 15,
    quality: 40
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'your settings',
    format: 'mp4',
    codec: highEfficiencyCodec.codec,
    resolution: { width: 1920, height: 1080, label: '1080p' },
    frameRate: 30,
    quality: 46
  }
];
