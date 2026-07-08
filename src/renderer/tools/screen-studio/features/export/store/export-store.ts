import { create } from 'zustand';
import type { AspectRatio, ExportCodec, ExportFormat } from '@screen-studio/types/export';
import { EXPORT_PRESETS } from '../presets';

const defaultPreset = EXPORT_PRESETS[0];

interface ExportStoreState {
  presetId: string;
  format: ExportFormat;
  codec: ExportCodec;
  aspectRatio: AspectRatio;
  resolution: { width: number; height: number };
  frameRate: number;
  quality: number;
  setPreset: (presetId: string) => void;
  setFormat: (format: ExportFormat) => void;
  setCodec: (codec: ExportCodec) => void;
  setAspectRatio: (aspectRatio: AspectRatio) => void;
  setResolution: (resolution: { width: number; height: number }) => void;
  setFrameRate: (frameRate: number) => void;
  setQuality: (quality: number) => void;
}

export const useExportStore = create<ExportStoreState>((set) => ({
  presetId: defaultPreset.id,
  format: defaultPreset.format,
  codec: defaultPreset.codec,
  aspectRatio: '16:9',
  resolution: { width: defaultPreset.resolution.width, height: defaultPreset.resolution.height },
  frameRate: defaultPreset.frameRate,
  quality: defaultPreset.quality,
  setPreset: (presetId) => {
    const preset = EXPORT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    set({
      presetId,
      format: preset.format,
      codec: preset.codec,
      resolution: { width: preset.resolution.width, height: preset.resolution.height },
      frameRate: preset.frameRate,
      quality: preset.quality
    });
  },
  // Any manual tweak after picking a preset detaches from that preset (falls
  // back to "Custom") so the UI doesn't show a preset selected that no
  // longer matches the actual settings.
  setFormat: (format) => set({ format, presetId: 'custom' }),
  setCodec: (codec) => set({ codec, presetId: 'custom' }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setResolution: (resolution) => set({ resolution, presetId: 'custom' }),
  setFrameRate: (frameRate) => set({ frameRate, presetId: 'custom' }),
  setQuality: (quality) => set({ quality, presetId: 'custom' })
}));
