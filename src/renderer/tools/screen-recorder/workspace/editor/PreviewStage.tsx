import type { JSX } from 'react';
import { useMemo, useRef, type RefObject, type SyntheticEvent } from 'react';
import type { PreviewVideoController, SourceResolution } from '@screen-recorder/types/editor';
import { useBackgroundStore } from '../../features/background/store/background-store';
import { backgroundLayerStyle } from '../../features/background/lib/background-css';
import { useZoomStore } from '../../features/zoom/store/zoom-store';
import { useCursorStore } from '../../features/cursor/store/cursor-store';
import { useExportStore } from '../../features/export/store/export-store';
import {
  useTimelineStore,
  PRIMARY_VIDEO_TRACK_ID
} from '../../features/timeline/store/timeline-store';
import { useAppStore } from '../../app/app-store';
import { CropOverlay } from '../../features/crop/components/CropOverlay';
import { CursorOverlay } from '../../features/cursor/components/CursorOverlay';
import { AnnotationOverlay } from '../../features/annotations/components/AnnotationOverlay';
import { BlurMaskOverlay } from '../../features/blur-mask/components/BlurMaskOverlay';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { resolveZoom } from '@shared/zoom-resolve';
import { cn } from '../../lib/utils';
import EditorLoading from './EditorLoading';
import VideoErrorOverlay from './VideoErrorOverlay';
import CaptionBar from './CaptionBar';
import WebcamPip from './WebcamPip';
import { useDualVideoPlayback } from './hooks/use-dual-video-playback';
import { useStageWidth } from './hooks/use-stage-width';
import { useAutoZoomFocalPaths } from './hooks/use-auto-zoom-focal-paths';
import { ASPECT_RATIO_VALUES } from './editorTools';

interface PreviewStageProps {
  videoRef: RefObject<PreviewVideoController | null>;
  previewUrl: string;
  isPlaying: boolean;
  videoError: string | null;
  currentTimeMs: number;
  cropToolActive: boolean;
  selectedSegmentId: string | null;
  sourceResolution: SourceResolution | null;
  onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  onPlay: () => void;
  onPause: () => void;
  onError: (message: string) => void;
  onTimeUpdate: (currentTimeMs: number) => void;
}

export function PreviewStage({
  videoRef,
  previewUrl,
  videoError,
  currentTimeMs,
  cropToolActive,
  selectedSegmentId,
  sourceResolution,
  onLoadedMetadata,
  onPlay,
  onPause,
  onError,
  onTimeUpdate
}: PreviewStageProps): JSX.Element {
  const background = useBackgroundStore();
  const exportAspectRatio = useExportStore((s) => s.aspectRatio);
  const zoomKeyframes = useZoomStore((s) => s.keyframes);
  const armedKeyframeId = useZoomStore((s) => s.armedKeyframeId);
  const updateKeyframe = useZoomStore((s) => s.updateKeyframe);
  const disarmPositioning = useZoomStore((s) => s.disarmPositioning);
  const cursor = useCursorStore();
  const rawCursorPath = useAppStore((s) => s.lastRecording?.cursorPath ?? []);
  const clickPath = useAppStore((s) => s.lastRecording?.clickPath ?? []);
  const webcamPreviewUrl = useAppStore((s) => s.lastRecording?.webcamPreviewUrl ?? null);
  const webcamOffsetMs = useAppStore((s) => s.lastRecording?.webcamOffsetMs ?? 0);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

  const autoZoomFocalPaths = useAutoZoomFocalPaths(rawCursorPath, zoomKeyframes);

  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const activeTool = useTimelineStore((s) => s.activeTool);
  const isHoverScrubbing = useTimelineStore((s) => s.isHoverScrubbing);

  const {
    videoARef,
    videoBRef,
    isSlotAActive,
    isVideoReady,
    zoomTimeMs,
    handleVideoLoadedMetadata,
    handleVideoPlay,
    handleVideoPause,
    handleVideoTimeUpdate,
    handleVideoError
  } = useDualVideoPlayback({
    videoRef,
    segments,
    setPlayhead,
    isHoverScrubbing,
    currentTimeMs,
    webcamVideoRef,
    webcamPreviewUrl,
    webcamOffsetMs,
    onPlay,
    onPause,
    onError,
    onTimeUpdate,
    onLoadedMetadata
  });

  const { stageRef, stageWidthPx } = useStageWidth();

  const {
    depth: zoomDepth,
    focal: zoomFocal,
    shift: zoomShift
  } = useMemo(
    () => resolveZoom(zoomTimeMs, zoomKeyframes, autoZoomFocalPaths),
    [zoomTimeMs, zoomKeyframes, autoZoomFocalPaths]
  );

  function handlePreviewClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!armedKeyframeId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    updateKeyframe(armedKeyframeId, { position: { x, y } });
    disarmPositioning();
  }

  const stageAspectRatio = ASPECT_RATIO_VALUES[exportAspectRatio];
  const sourceAspectRatio = sourceResolution
    ? sourceResolution.width / sourceResolution.height
    : undefined;

  // Per-clip "Hide mouse cursor" (see CutTimeline.tsx's context menu) --
  // independent of the global `cursor.visible` toggle, which CursorOverlay
  // already handles on its own.
  const activeSegmentForCursor = segments.find(
    (s) => zoomTimeMs >= s.range.startMs && zoomTimeMs < s.range.endMs
  );

  const previewScale = stageWidthPx > 0 ? stageWidthPx / REFERENCE_CANVAS_WIDTH : 1;
  const contentBorderRadius = background.cornerRadius * previewScale;
  const contentBoxShadow =
    background.shadow > 0
      ? `0 ${Math.round(background.shadow * 0.3 * previewScale)}px ${Math.round(background.shadow * 0.7 * previewScale)}px rgba(0, 0, 0, ${(0.15 + (background.shadow / 100) * 0.45).toFixed(2)})`
      : 'none';

  return (
    <div className="m-6 flex flex-1 items-center justify-center overflow-hidden">
      <div
        ref={stageRef}
        className="relative isolate flex max-h-full max-w-full overflow-hidden rounded-xl border border-border"
        style={{ padding: `${background.padding}%`, aspectRatio: stageAspectRatio }}
      >
        <div className="absolute inset-0 -z-10" style={backgroundLayerStyle(background)} />
        {background.kind === 'image' && background.blur > 0 && (
          <div
            className="absolute inset-0 -z-10"
            style={{
              ...backgroundLayerStyle(background),
              filter: `blur(${background.blur}px)`,
              transform: 'scale(1.15)'
            }}
          />
        )}

        <div className="relative flex flex-1 items-center justify-center">
          <div
            ref={videoWrapperRef}
            onClick={handlePreviewClick}
            className={cn(
              'relative max-h-full max-w-full overflow-hidden',
              armedKeyframeId && 'cursor-crosshair'
            )}
            style={{
              aspectRatio: sourceAspectRatio,
              borderRadius: contentBorderRadius,
              boxShadow: contentBoxShadow,
              transform: `translate(${zoomShift.x * 100}%, ${zoomShift.y * 100}%) scale(${zoomDepth})`,
              transformOrigin: `${zoomFocal.x * 100}% ${zoomFocal.y * 100}%`
            }}
          >
            <video
              ref={videoARef}
              key={`${previewUrl}-a`}
              src={previewUrl}
              className={cn(
                'h-full w-full object-contain',
                isSlotAActive ? '' : 'absolute inset-0 pointer-events-none opacity-0'
              )}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onTimeUpdate={handleVideoTimeUpdate}
              onError={handleVideoError}
            />
            <video
              ref={videoBRef}
              key={`${previewUrl}-b`}
              src={previewUrl}
              className={cn(
                'h-full w-full object-contain',
                !isSlotAActive ? '' : 'absolute inset-0 pointer-events-none opacity-0'
              )}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onTimeUpdate={handleVideoTimeUpdate}
              onError={handleVideoError}
            />

            {cropToolActive && sourceResolution && selectedSegmentId && (
              <CropOverlay
                key={selectedSegmentId}
                segmentId={selectedSegmentId}
                sourceWidth={sourceResolution.width}
                sourceHeight={sourceResolution.height}
              />
            )}

            {!cropToolActive && (
              <BlurMaskOverlay
                currentTimeMs={zoomTimeMs}
                editable={activeTool === 'blur-mask'}
                stageWidthPx={stageWidthPx}
              />
            )}

            {!cropToolActive && (
              <CursorOverlay
                cursor={cursor}
                rawPath={rawCursorPath}
                clickPath={clickPath}
                currentTimeMs={zoomTimeMs}
                stageWidthPx={stageWidthPx}
                cursorHidden={activeSegmentForCursor?.cursorHidden ?? false}
              />
            )}
          </div>

          {videoError && <VideoErrorOverlay message={videoError} />}

          {!cropToolActive && (
            <AnnotationOverlay currentTimeMs={zoomTimeMs} stageWidthPx={stageWidthPx} />
          )}
        </div>

        <WebcamPip
          stageRef={stageRef}
          webcamVideoRef={webcamVideoRef}
          previewScale={previewScale}
          cropToolActive={cropToolActive}
        />

        <CaptionBar currentTimeMs={zoomTimeMs} />
        {!isVideoReady && !videoError && <EditorLoading />}
      </div>
    </div>
  );
}
