import { useRef, useState } from 'react';
import { useScreenRecorderStore } from '../../../store/screen-recorder-store';
import { useTimelineStore, PRIMARY_VIDEO_TRACK_ID } from '../../timeline/store/timeline-store';
import { getSegmentOutputDurationMs } from '../../timeline/lib/segment-duration';
import { useCropStore } from '../../crop/store/crop-store';
import { useBackgroundStore } from '../../background/store/background-store';
import { useExportStore, toEven } from '../store/export-store';
import { buildExportProject } from '../lib/build-export-project';
import { runExport } from '../engine/export-coordinator';
import { isExportCancelled } from '../engine/cancel';
import { estimateRawExportBytes } from '../lib/estimate-export';
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
  const lastRecording = useScreenRecorderStore((state) => state.lastRecording);
  const sourceResolution = useScreenRecorderStore((state) => state.sourceResolution);
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const crop = useCropStore((s) => s.rect);
  const backgroundEnabled = useBackgroundStore((s) => s.enabled);
  const store = useExportStore();

  // With no background, the export canvas follows the recording's own
  // (cropped) native resolution instead of the aspect-ratio picker's fixed
  // preset -- same reasoning as PreviewStage.tsx's `stageAspectRatio`, kept
  // at the recording's *actual* pixel size (not resampled to the picker's
  // long-edge preset) so disabling the background doesn't also silently
  // change output quality. Falls back to `store.resolution` if metadata
  // hasn't loaded yet (shouldn't happen in practice -- `canExport` below
  // requires a loaded recording).
  const effectiveResolution =
    !backgroundEnabled && sourceResolution
      ? {
          width: toEven(crop ? sourceResolution.width * crop.width : sourceResolution.width),
          height: toEven(crop ? sourceResolution.height * crop.height : sourceResolution.height)
        }
      : store.resolution;

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
      // No separate global toggle -- skip audio entirely when every kept
      // clip is muted, rather than encoding a track that would be silent
      // from end to end anyway.
      const includeAudio = segments.some((s) => !s.audioMuted);
      const { actualBytes, wasEncoded, includedAudio } = await runExport(
        {
          format: store.format,
          codec: store.codec,
          aspectRatio: store.aspectRatio,
          resolution: effectiveResolution,
          frameRate: store.frameRate,
          quality: store.quality,
          includeAudio,
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
      // Fold this real export's actual size into the size-estimate's
      // learned calibration -- skipped for the "source copy" fast path
      // (see RunExportResult's own doc), which never touches the encoder.
      // Uses `includedAudio` (what the export actually ended up with), not
      // the `includeAudio` request above -- the source can lack an audio
      // track entirely even when every clip is unmuted, in which case the
      // real output has no audio bytes at all; estimating as if it did would
      // inflate `rawEstimatedBytes` with a phantom audio bitrate and bias
      // `sizeCalibrationRatio` down for every recording after this one.
      if (wasEncoded) {
        const rawEstimatedBytes = estimateRawExportBytes({
          durationMs,
          width: effectiveResolution.width,
          height: effectiveResolution.height,
          frameRate: store.frameRate,
          quality: store.quality,
          includeAudio: includedAudio,
          format: store.format,
          hasWebcam: project.webcam.enabled
        });
        store.recordActualExportSize(rawEstimatedBytes, actualBytes);
      }
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
