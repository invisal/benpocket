import { useRef, useState } from 'react';
import { useAppStore } from '../../../app/app-store';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { getSegmentOutputDurationMs } from '../../timeline/lib/segment-duration';
import { useExportStore } from '../store/export-store';
import { buildExportProject } from '../lib/build-export-project';
import { runExport } from '../engine/export-coordinator';
import { isExportCancelled } from '../engine/cancel';

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
  handleCancel: () => void;
}

/**
 * Shared export trigger: save-path dialog -> screenRecorder.export.start ->
 * live progress via onProgress -> error surfacing.
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
  const abortControllerRef = useRef<AbortController | null>(null);

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

    const outputPath = await window.screenRecorder.dialog.showSaveExportPath(
      `export.${store.format}`,
      store.format
    );
    if (!outputPath) return;

    setStatus('exporting');
    setError(null);
    setProgress({ percent: 0, stage: 'rendering' });

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const durationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
      await runExport(
        {
          format: store.format,
          codec: store.codec,
          aspectRatio: store.aspectRatio,
          resolution: store.resolution,
          frameRate: store.frameRate,
          quality: store.quality,
          includeAudio: store.includeAudio,
          outputPath,
          sourceVideoPath,
          segments: segments.map((s) => ({ range: s.range, crop: s.crop, speed: s.speed })),
          project: buildExportProject(sourceVideoPath, durationMs)
        },
        (p) => {
          setProgress({ percent: p.percent, stage: p.stage });
          if (p.stage === 'error' && p.error) setError(p.error);
        },
        controller.signal
      );
      setStatus('idle');
      setProgress(null);
    } catch (err) {
      if (isExportCancelled(err)) {
        setStatus('idle');
        setProgress(null);
      } else {
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      abortControllerRef.current = null;
    }
  }

  function handleCancel(): void {
    abortControllerRef.current?.abort();
  }

  return {
    status,
    error,
    progress,
    canExport: Boolean(lastRecording),
    handleExport,
    handleCancel
  };
}
