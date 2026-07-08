import { useState } from 'react';
import { useAppStore } from '../../../app/app-store';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { useExportStore } from '../store/export-store';
import { buildExportProject } from '../lib/build-export-project';

export type ExportStatus = 'idle' | 'exporting' | 'error';

export interface ExportProgressState {
  percent: number;
  stage: string;
}

interface UseExportActionResult {
  status: ExportStatus;
  error: string | null;
  progress: ExportProgressState | null;
  canExport: boolean;
  handleExport: () => Promise<void>;
}

/**
 * Shared export trigger: save-path dialog -> screenStudio.export.start ->
 * live progress via onProgress -> error surfacing. Used by both the
 * top-nav ExportButton (quick export with current settings) and
 * ExportSidePanel's full config panel, so the flow only lives once.
 */
export function useExportAction(): UseExportActionResult {
  const lastRecording = useAppStore((state) => state.lastRecording);
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const store = useExportStore();

  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgressState | null>(null);

  async function handleExport(): Promise<void> {
    const sourceVideoPath = lastRecording?.filePath ?? null;
    if (!sourceVideoPath) {
      setStatus('error');
      setError('Recording is still being saved. Try again in a moment.');
      return;
    }
    if (segments.length === 0 || segments.some((s) => s.range.endMs <= s.range.startMs)) {
      setStatus('error');
      setError('Nothing to export -- cut out every clip on the timeline.');
      return;
    }

    const outputPath = await window.screenStudio.dialog.showSaveExportPath(
      `export.${store.format}`,
      store.format
    );
    if (!outputPath) return;

    setStatus('exporting');
    setError(null);
    setProgress({ percent: 0, stage: 'rendering' });

    const unsubscribe = window.screenStudio.export.onProgress((p) => {
      setProgress({ percent: p.percent, stage: p.stage });
      if (p.stage === 'error' && p.error) setError(p.error);
    });

    try {
      const durationMs = segments.reduce((sum, s) => sum + (s.range.endMs - s.range.startMs), 0);
      await window.screenStudio.export.start({
        format: store.format,
        codec: store.codec,
        aspectRatio: store.aspectRatio,
        resolution: store.resolution,
        frameRate: store.frameRate,
        quality: store.quality,
        outputPath,
        sourceVideoPath,
        segments: segments.map((s) => ({ range: s.range, crop: s.crop })),
        project: buildExportProject(sourceVideoPath, durationMs)
      });
      setStatus('idle');
      setProgress(null);
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      unsubscribe();
    }
  }

  return { status, error, progress, canExport: Boolean(lastRecording), handleExport };
}
