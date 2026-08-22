import type { JSX } from 'react';
import { useMemo, useRef, type RefObject, type SyntheticEvent } from 'react';
import type { PreviewVideoController, SourceResolution } from '@screen-recorder/types/editor';
import { useBackgroundStore } from '../../features/background/store/background-store';
import { backgroundLayerStyle } from '../../features/background/lib/background-css';
import { useZoomStore } from '../../features/zoom/store/zoom-store';
import { useCursorStore } from '../../features/cursor/store/cursor-store';
import { useCropStore } from '../../features/crop/store/crop-store';
import { useExportStore } from '../../features/export/store/export-store';
import {
  useTimelineStore,
  PRIMARY_VIDEO_TRACK_ID
} from '../../features/timeline/store/timeline-store';
import {
  useScreenRecorderStore,
  EMPTY_CURSOR_PATH,
  EMPTY_RESIZE_PATH
} from '../../store/screen-recorder-store';
import { CursorOverlay } from '../../features/cursor/components/CursorOverlay';
import { useClickSound } from '../../features/cursor/lib/use-click-sound';
import { isLikelyLinux } from '../../lib/platform';
import { AnnotationOverlay } from '../../features/annotations/components/AnnotationOverlay';
import { BlurMaskOverlay } from '../../features/blur-mask/components/BlurMaskOverlay';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { resolveZoom } from '@shared/zoom-resolve';
import { remapPathToCropSpace } from '@shared/cursor-path';
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
  /** Undefined while a project is still loading (see EditorPage.tsx) -- the loading condition below covers that the same way it already covers metadata not being ready yet. */
  previewUrl: string | undefined;
  isPlaying: boolean;
  videoError: string | null;
  currentTimeMs: number;
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
  const cursor = useCursorStore();
  const rawCursorPath = useScreenRecorderStore(
    (s) => s.lastRecording?.cursorPath ?? EMPTY_CURSOR_PATH
  );
  const clickPath = useScreenRecorderStore((s) => s.lastRecording?.clickPath ?? EMPTY_CURSOR_PATH);
  // No position to remap -- a resize sample only carries `.atMs`.
  const resizePath = useScreenRecorderStore(
    (s) => s.lastRecording?.resizePath ?? EMPTY_RESIZE_PATH
  );
  const isImportedProject = useScreenRecorderStore((s) => s.lastRecording?.source === 'imported');
  const webcamPreviewUrl = useScreenRecorderStore((s) => s.lastRecording?.webcamPreviewUrl ?? null);
  const webcamOffsetMs = useScreenRecorderStore((s) => s.lastRecording?.webcamOffsetMs ?? 0);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);

  // Crop (see CropDialog, opened from EditorTransportBar's Crop button) --
  // a single rect for the whole recording, not per-clip. Declared here
  // (rather than alongside `videoCropStyle` below, where it's also used)
  // because `rawCursorPath`/`clickPath` are captured in full-source-frame
  // space and everything that positions itself as a fraction of the
  // (possibly cropped) content box -- cursor icon, click ripples,
  // auto-zoom's focal point -- needs the crop-remapped versions instead;
  // see `remapPathToCropSpace`'s own doc.
  const activeCrop = useCropStore((s) => s.rect);
  const croppedCursorPath = useMemo(
    () => remapPathToCropSpace(rawCursorPath, activeCrop),
    [rawCursorPath, activeCrop]
  );
  const croppedClickPath = useMemo(
    () => remapPathToCropSpace(clickPath, activeCrop),
    [clickPath, activeCrop]
  );

  const autoZoomFocalPaths = useAutoZoomFocalPaths(croppedCursorPath, zoomKeyframes);

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

  useClickSound(
    clickPath,
    zoomTimeMs,
    !isImportedProject && !isLikelyLinux && cursor.clickSoundEnabled,
    cursor.clickBounce
  );

  const { stageRef, stageWidthPx } = useStageWidth();

  const {
    depth: zoomDepth,
    focal: zoomFocal,
    shift: zoomShift
  } = useMemo(
    () => resolveZoom(zoomTimeMs, zoomKeyframes, autoZoomFocalPaths),
    [zoomTimeMs, zoomKeyframes, autoZoomFocalPaths]
  );

  const sourceAspectRatio = sourceResolution
    ? sourceResolution.width / sourceResolution.height
    : undefined;

  // Per-clip "Hide mouse cursor" / "Hide webcam" (see CutTimeline.tsx's
  // context menu) -- independent of the global `cursor.visible` /
  // `webcam.enabled` toggles, which CursorOverlay/WebcamPip already handle
  // on their own.
  const activeSegment = segments.find(
    (s) => zoomTimeMs >= s.range.startMs && zoomTimeMs < s.range.endMs
  );

  // Crop (see CropDialog, opened from EditorTransportBar's Crop button) --
  // a single rect for the whole recording, not per-clip. `croppedAspectRatio`
  // reshapes the wrapper box itself to the crop's own shape; `videoCropStyle`
  // then scales+shifts the video via `transform` (not `position`/`width`/
  // `height`) so the cropped region exactly fills that reshaped box,
  // `overflow-hidden` on the wrapper clipping the rest.
  //
  // This MUST be a `transform`, not absolute positioning + percentage
  // width/height -- a `<video>` is a replaced element, and its intrinsic
  // (native pixel) size is what lets `videoWrapperRef`'s own `aspect-ratio`
  // (which alone is under-specified: no explicit width or height anywhere
  // in this chain, all the way up to `stageRef`) resolve to a real size at
  // all. Taking the video out of normal flow via `position: absolute` drops
  // it from that intrinsic-size contribution entirely, so the wrapper (and
  // `stageRef` above it, which depends on the wrapper the same way) had
  // nothing left to size themselves from and collapsed to ~0 -- confirmed
  // by inspecting computed styles live: wrapper `width/height` read `0px`
  // the instant `position: absolute` was in play. A `transform` never
  // affects layout/intrinsic sizing (it's paint-only), so the video keeps
  // contributing its normal size and this same cascade keeps working.
  // `object-fit: fill` on top so the video's own aspect-corrective
  // letterboxing doesn't fight this transform's own (already
  // aspect-correct, per the math below) scaling.
  const croppedAspectRatio =
    activeCrop && sourceResolution
      ? (activeCrop.width * sourceResolution.width) / (activeCrop.height * sourceResolution.height)
      : sourceAspectRatio;
  const videoCropStyle = activeCrop
    ? {
        objectFit: 'fill' as const,
        transformOrigin: 'top left',
        transform: `scale(${1 / activeCrop.width}, ${1 / activeCrop.height}) translate(${-activeCrop.x * 100}%, ${-activeCrop.y * 100}%)`
      }
    : undefined;

  // With no background, the stage takes the recording's own (cropped)
  // aspect ratio instead of the fixed export-settings one, so the video
  // fills the frame edge-to-edge instead of leaving empty canvas margin
  // that -- with no background layer left to paint into it -- would
  // otherwise show through as bare space rather than actual letterboxing.
  // Falls back to the fixed aspect while metadata hasn't loaded yet
  // (`croppedAspectRatio` is undefined pre-metadata) -- purely a brief
  // loading-state stand-in, corrected the instant `onLoadedMetadata` fires.
  const stageAspectRatio = background.enabled
    ? ASPECT_RATIO_VALUES[exportAspectRatio]
    : (croppedAspectRatio ?? ASPECT_RATIO_VALUES[exportAspectRatio]);

  const previewScale = stageWidthPx > 0 ? stageWidthPx / REFERENCE_CANVAS_WIDTH : 1;
  const contentBorderRadius = background.enabled ? background.cornerRadius * previewScale : 0;
  const contentBoxShadow =
    background.enabled && background.shadow > 0
      ? // No offset -- 4th value is spread, growing the shadow rect evenly on
        // every edge (matching shadow-corner.ts's export render) instead of
        // the 2nd/3rd-value directional offset this used to read as, which
        // only ever poked out from underneath the content.
        `0 0 ${Math.round(background.shadow * 0.7 * previewScale)}px ${Math.round(background.shadow * 0.3 * previewScale)}px rgba(0, 0, 0, ${(0.15 + (background.shadow / 100) * 0.45).toFixed(2)})`
      : 'none';

  return (
    <div className="m-6 flex flex-1 items-center justify-center overflow-hidden">
      <div
        ref={stageRef}
        className="relative isolate flex max-h-full max-w-full overflow-hidden rounded-xl border border-border"
        style={{
          padding: background.enabled ? `${background.padding}%` : 0,
          aspectRatio: stageAspectRatio
        }}
      >
        {background.enabled && (
          <>
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
          </>
        )}

        <div className="relative flex flex-1 items-center justify-center">
          <div
            ref={videoWrapperRef}
            className="relative max-h-full max-w-full overflow-hidden"
            style={{
              aspectRatio: croppedAspectRatio,
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
              preload={isSlotAActive ? 'auto' : 'metadata'}
              className={cn(
                'h-full w-full object-contain',
                isSlotAActive ? '' : 'absolute inset-0 pointer-events-none opacity-0'
              )}
              style={videoCropStyle}
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
              preload={!isSlotAActive ? 'auto' : 'metadata'}
              className={cn(
                'h-full w-full object-contain',
                !isSlotAActive ? '' : 'absolute inset-0 pointer-events-none opacity-0'
              )}
              style={videoCropStyle}
              onLoadedMetadata={handleVideoLoadedMetadata}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onTimeUpdate={handleVideoTimeUpdate}
              onError={handleVideoError}
            />

            <BlurMaskOverlay
              currentTimeMs={zoomTimeMs}
              editable={activeTool === 'blur-mask'}
              stageWidthPx={stageWidthPx}
            />

            {!isImportedProject && !isLikelyLinux && (
              <CursorOverlay
                cursor={cursor}
                rawPath={croppedCursorPath}
                clickPath={croppedClickPath}
                resizePath={resizePath}
                currentTimeMs={zoomTimeMs}
                stageWidthPx={stageWidthPx}
                cursorHidden={activeSegment?.cursorHidden ?? false}
              />
            )}
          </div>

          {videoError && <VideoErrorOverlay message={videoError} />}

          <AnnotationOverlay currentTimeMs={zoomTimeMs} stageWidthPx={stageWidthPx} />
        </div>

        <WebcamPip
          stageRef={stageRef}
          webcamVideoRef={webcamVideoRef}
          previewScale={previewScale}
          referenceHeight={REFERENCE_CANVAS_WIDTH / stageAspectRatio}
          webcamHidden={activeSegment?.webcamHidden ?? false}
        />

        <CaptionBar currentTimeMs={zoomTimeMs} />
        {(!previewUrl || !isVideoReady) && !videoError && <EditorLoading />}
      </div>
    </div>
  );
}
