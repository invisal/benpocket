import { useRef, useState } from 'react';
import { useAppStore } from '../../../app/app-store';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { getSegmentOutputDurationMs } from '../../timeline/lib/segment-duration';
import { useExportStore } from '../store/export-store';
import { buildExportProject } from '../lib/build-export-project';
import { runExport } from '../engine/export-coordinator';
import { isExportCancelled } from '../engine/cancel';

export type ExportStatus = 'idle' | 'exporting' | 'error';

/** "Screen-Record-2026-07-23 14.30.05" -- periods (not colons) in the time so it's a valid file name on every OS. */
function defaultExportFileName(): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, '0');
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}.${pad(now.getMinutes())}.${pad(now.getSeconds())}`;
  return `Screen-Record-${date} ${time}`;
}

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
      `${defaultExportFileName()}.${store.format}`,
      store.format
    );
    if (!outputPath) return;

    setStatus('exporting');
    setError(null);
    setProgress({ percent: 0, stage: 'rendering' });
    store.setIsExporting(true);

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

      // The raw recording (and its parallel webcam file, if any) is no
      // longer needed once export succeeds -- delete both so they don't
      // linger on disk forever. Deliberate tradeoff: exporting this same
      // recording again afterward will fail with the source gone, since
      // this deletes right away rather than waiting for the user to
      // navigate away from it. Fire-and-forget -- export itself already
      // finished successfully; a cleanup failure here shouldn't reopen it.
      if (lastRecording?.filePath) {
        window.screenRecorder.recording
          .deleteFile(lastRecording.filePath)
          .catch((err) => console.error('[export] failed to delete raw recording file:', err));
      }
      if (lastRecording?.webcamFilePath) {
        window.screenRecorder.recording
          .deleteFile(lastRecording.webcamFilePath)
          .catch((err) => console.error('[export] failed to delete raw webcam file:', err));
      }
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
      store.setIsExporting(false);
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
