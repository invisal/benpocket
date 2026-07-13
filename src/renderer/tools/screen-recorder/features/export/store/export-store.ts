import { create } from 'zustand';
import type { AspectRatio, ExportCodec, ExportFormat } from '@screen-recorder/types/export';
import { EXPORT_PRESETS } from '../presets';

const defaultPreset = EXPORT_PRESETS[0];

const ASPECT_RATIO_VALUES: Record<AspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3
};

function toEven(n: number): number {
  return Math.max(2, Math.round(n / 2) * 2);
}

/**
 * Applies `aspectRatio` to a resolution's long edge (all `RESOLUTION_OPTIONS`
 * and preset resolutions are authored as 16:9 width x height pairs, so the
 * long edge is always their `width`) -- e.g. 1920x1080 at '9:16' becomes
 * 1080x1920. This is what actually makes the aspect-ratio picker affect the
 * export: main/export-manager.ts sizes its canvas from `resolution` alone,
 * it has no separate notion of `aspectRatio`.
 */
function resolveResolution(
  longEdge: number,
  aspectRatio: AspectRatio
): { width: number; height: number } {
  const ratio = ASPECT_RATIO_VALUES[aspectRatio];
  return ratio >= 1
    ? { width: toEven(longEdge), height: toEven(longEdge / ratio) }
    : { width: toEven(longEdge * ratio), height: toEven(longEdge) };
}

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
    set((state) => ({
      presetId,
      format: preset.format,
      codec: preset.codec,
      resolution: resolveResolution(preset.resolution.width, state.aspectRatio),
      frameRate: preset.frameRate,
      quality: preset.quality
    }));
  },
  // Any manual tweak after picking a preset detaches from that preset (falls
  // back to "Custom") so the UI doesn't show a preset selected that no
  // longer matches the actual settings.
  setFormat: (format) => set({ format, presetId: 'custom' }),
  setCodec: (codec) => set({ codec, presetId: 'custom' }),
  setAspectRatio: (aspectRatio) =>
    set((state) => ({
      aspectRatio,
      resolution: resolveResolution(
        Math.max(state.resolution.width, state.resolution.height),
        aspectRatio
      )
    })),
  setResolution: (resolution) =>
    set((state) => ({
      resolution: resolveResolution(
        Math.max(resolution.width, resolution.height),
        state.aspectRatio
      ),
      presetId: 'custom'
    })),
  setFrameRate: (frameRate) => set({ frameRate, presetId: 'custom' }),
  setQuality: (quality) => set({ quality, presetId: 'custom' })
}));
