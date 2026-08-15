import { useRef, useState } from 'react';
import { useAppStore } from '../../../app/app-store';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { getSegmentOutputDurationMs } from '../../timeline/lib/segment-duration';
import { useCropStore } from '../../crop/store/crop-store';
import { useExportStore } from '../store/export-store';
import { buildExportProject } from '../lib/build-export-project';
import { runExport } from '../engine/export-coordinator';
import { isExportCancelled } from '../engine/cancel';
import { WALLPAPER_IMAGE_PRESETS } from '../../background/lib/wallpaper-images';

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
  handleCopyToClipboard: () => Promise<void>;
  handleCancel: () => void;
}

/**
 * Shared export trigger, two flavors sharing one pipeline run:
 * - `handleExport`: save-path dialog -> encode straight to that path.
 * - `handleCopyToClipboard`: encode to a temp file -> write that file's path
 *   to the OS clipboard as a file reference (see copy-file-to-clipboard.ts),
 *   so pasting elsewhere pastes the real exported file.
 * Both report progress and errors the same way, and both can be cancelled.
 */
export function useExportAction(): UseExportActionResult {
  const lastRecording = useAppStore((state) => state.lastRecording);
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const crop = useCropStore((s) => s.rect);
  const store = useExportStore();

  const [status, setStatus] = useState<ExportStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ExportProgressState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  function validateExportable(): string | null {
    // Prefer the untouched export-source file over `filePath` when the two
    // differ -- see LastRecording.exportSourceFilePath's doc.
    const sourceVideoPath = lastRecording?.exportSourceFilePath ?? lastRecording?.filePath ?? null;
    if (!sourceVideoPath) {
      setStatus('error');
      setError('Recording is still being saved. Try again in a moment.');
      return null;
    }
    if (segments.length === 0 || segments.some((s) => s.range.endMs <= s.range.startMs)) {
      setStatus('error');
      setError('Nothing to export -- cut out every clip on the timeline.');
      return null;
    }
    return sourceVideoPath;
  }

  async function runExportPipeline(
    sourceVideoPath: string,
    outputPath: string,
    afterSuccess?: () => Promise<void>
  ): Promise<void> {
    setStatus('exporting');
    setError(null);
    setProgress({ percent: 0, stage: 'rendering' });
    store.setIsExporting(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const durationMs = segments.reduce((sum, s) => sum + getSegmentOutputDurationMs(s), 0);
      const project = buildExportProject(sourceVideoPath, durationMs);
      await runExport(
        {
          format: store.format,
          codec: store.codec,
          aspectRatio: store.aspectRatio,
          resolution: store.resolution,
          frameRate: store.frameRate,
          quality: store.quality,
          // No separate global toggle -- skip audio entirely when every kept
          // clip is muted, rather than encoding a track that would be
          // silent from end to end anyway.
          includeAudio: segments.some((s) => !s.audioMuted),
          outputPath,
          sourceVideoPath,
          crop,
          segments: segments.map((s) => ({
            range: s.range,
            speed: s.speed,
            cursorHidden: s.cursorHidden,
            webcamHidden: s.webcamHidden,
            audioMuted: s.audioMuted,
            audioVolume: s.audioVolume
          })),
          project
        },
        (p) => {
          setProgress({ percent: p.percent, stage: p.stage });
          if (p.stage === 'error' && p.error) setError(p.error);
        },
        controller.signal
      );
      if (afterSuccess) await afterSuccess();
      setStatus('idle');
      setProgress(null);
      window.telemetry.send({
        event: 'screen-recorder:export',
        format: store.format,
        durationSec: Math.round(durationMs / 1000),
        presetId: store.presetId,
        clipCount: segments.length,
        hasAnnotations: project.annotations.length > 0,
        hasCaptions: project.captions.segments.length > 0,
        hasBlurMask: project.blurMasks.length > 0,
        hasZoom: project.zoomKeyframes.length > 0,
        hasCustomBackground:
          project.background.kind !== 'wallpaper' ||
          project.background.value !== WALLPAPER_IMAGE_PRESETS[0].id,
        hasWebcamOverlay: project.webcam.enabled && project.webcamVideoPath !== null
      });
    } catch (err) {
      if (isExportCancelled(err)) {
        setStatus('idle');
        setProgress(null);
      } else {
        console.error('[export] failed:', err);
        setStatus('error');
        setError(err instanceof Error ? err.message : String(err));
        window.telemetry.send({ event: 'screen-recorder:export_failed' });
      }
    } finally {
      abortControllerRef.current = null;
      store.setIsExporting(false);
    }
  }

  async function handleExport(): Promise<void> {
    const sourceVideoPath = validateExportable();
    if (!sourceVideoPath) return;

    const outputPath = await window.screenRecorder.dialog.showSaveExportPath(
      `${defaultExportFileName()}.${store.format}`,
      store.format
    );
    if (!outputPath) return;

    await runExportPipeline(sourceVideoPath, outputPath);
  }

  async function handleCopyToClipboard(): Promise<void> {
    const sourceVideoPath = validateExportable();
    if (!sourceVideoPath) return;

    const outputPath = await window.screenRecorder.export.getTempPath(
      `${defaultExportFileName()}.${store.format}`
    );

    await runExportPipeline(sourceVideoPath, outputPath, () =>
      window.screenRecorder.export.copyToClipboard(outputPath)
    );
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
    handleCopyToClipboard,
    handleCancel
  };
}
