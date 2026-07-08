import type { ExportCodec, ExportFormat } from '@screen-studio/types/export';

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

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: 'web',
    label: 'Web',
    description: '1080p · H.265',
    format: 'mp4',
    codec: 'h265',
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
    codec: 'h265',
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
    codec: 'h265',
    resolution: { width: 1920, height: 1080, label: '1080p' },
    frameRate: 30,
    quality: 46
  }
];

export const CODEC_OPTIONS: { id: ExportCodec; label: string; description: string }[] = [
  { id: 'h264', label: 'H.264', description: 'compatible' },
  { id: 'h265', label: 'H.265', description: 'smaller' },
  { id: 'av1', label: 'AV1', description: 'smallest' }
];

export const FORMAT_OPTIONS: { id: ExportFormat; label: string }[] = [
  { id: 'mp4', label: 'MP4' },
  { id: 'webm', label: 'WebM' },
  { id: 'mov', label: 'MOV' },
  { id: 'gif', label: 'GIF' }
];

export const RESOLUTION_OPTIONS = [
  { width: 1280, height: 720, label: '720p' },
  { width: 1920, height: 1080, label: '1080p' },
  { width: 2560, height: 1440, label: '1440p' },
  { width: 3840, height: 2160, label: '2160p' }
];

export const FRAME_RATE_OPTIONS = [24, 30, 60];

export function qualityLabel(quality: number): string {
  if (quality <= 25) return 'Draft';
  if (quality <= 60) return 'Balanced';
  if (quality <= 90) return 'High';
  return 'Lossless';
}
