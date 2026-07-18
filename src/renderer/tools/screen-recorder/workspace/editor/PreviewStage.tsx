import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Play } from 'lucide-react';
import type { AspectRatio } from '@screen-recorder/types/export';
import { useBackgroundStore } from '../../features/background/store/background-store';
import { backgroundLayerStyle } from '../../features/background/lib/background-css';
import { useWebcamStore } from '../../features/webcam/store/webcam-store';
import { useCaptionsStore } from '../../features/captions/store/captions-store';
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
import { beginGesture, endGesture } from '../../features/history/store/history-store';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { resolveZoom } from '@shared/zoom-resolve';
import { smoothCursorPath } from '@shared/cursor-path';
import { mediaErrorMessage } from '../../lib/media';
import { cn } from '../../lib/utils';

/**
 * Numeric width/height ratios for the export aspect ratio picker -- the live
 * stage is shaped to match whichever one is selected (see main/export
 * frame-compositor.ts's `computeInnerRect`, which the stage/video-wrapper
 * split below mirrors: an outer canvas at this ratio, background-padded,
 * with the source video contain-fit inside at *its own* ratio).
 */
const ASPECT_RATIO_VALUES: Record<AspectRatio, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '1:1': 1,
  '4:3': 4 / 3
};

interface PreviewStageProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  previewUrl: string;
  isPlaying: boolean;
  videoError: string | null;
  currentTimeMs: number;
  cropToolActive: boolean;
  selectedSegmentId: string | null;
  sourceResolution: { width: number; height: number } | null;
  onLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  onPlay: () => void;
  onPause: () => void;
  onError: (message: string) => void;
  onTimeUpdate: (currentTimeMs: number) => void;
}

/**
 * The big preview canvas -- a live, best-effort approximation of what
 * main/export/frame-compositor.ts will actually render: wallpaper/gradient/
 * color/image background (features/background/lib/background-css.ts is the
 * CSS mirror of frame-compositor.ts's drawBackground), the recording padded
 * and letterboxed inside it, a draggable webcam PiP, and a captions bar when
 * there's an active caption segment at the current preview time.
 */
export function PreviewStage({
  videoRef,
  previewUrl,
  isPlaying,
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
  const webcam = useWebcamStore();
  const captionSegments = useCaptionsStore((s) => s.segments);
  const captionsEnabled = useCaptionsStore((s) => s.enabled);
  const zoomKeyframes = useZoomStore((s) => s.keyframes);
  const armedKeyframeId = useZoomStore((s) => s.armedKeyframeId);
  const updateKeyframe = useZoomStore((s) => s.updateKeyframe);
  const disarmPositioning = useZoomStore((s) => s.disarmPositioning);
  const cursor = useCursorStore();
  const cursorSmoothing = useCursorStore((s) => s.smoothing);
  const rawCursorPath = useAppStore((s) => s.lastRecording?.cursorPath ?? []);
  const clickPath = useAppStore((s) => s.lastRecording?.clickPath ?? []);
  // Same smoothing pass the export compositor applies (see
  // FrameCompositor.create), so 'auto-cursor' zoom keyframes and the export
  // follow the identical (smoothed) trajectory.
  const smoothedCursorPath = useMemo(
    () => smoothCursorPath(rawCursorPath, cursorSmoothing),
    [rawCursorPath, cursorSmoothing]
  );

  // Preview plays the raw source continuously rather than ripple-editing cut
  // segments (same WYSIWYG-by-overlay approach already used for crop), but
  // it should still play each clip back at its own authored speed. Kept in a
  // ref (not read directly in the tick loop below) since that effect has an
  // empty dep array and would otherwise close over a stale `segments`.
  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const activeTool = useTimelineStore((s) => s.activeTool);
  const segmentsRef = useRef(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // While a ruler/clip hover-scrub is in progress (see CutTimeline.tsx),
  // `previewSeek` still moves the actual video so this stage shows the
  // hovered frame, but the tick loop below should *not* sync that back into
  // `playheadMs` -- the main playhead stays put until the hover commits.
  // Ref (not read directly), same reason `segmentsRef` is: the tick loop's
  // effect has an empty dep array and would otherwise close over a stale
  // value.
  const isHoverScrubbing = useTimelineStore((s) => s.isHoverScrubbing);
  const isHoverScrubbingRef = useRef(isHoverScrubbing);
  useEffect(() => {
    isHoverScrubbingRef.current = isHoverScrubbing;
  }, [isHoverScrubbing]);

  // `currentTimeMs` only updates on the video's `timeupdate` event, which
  // browsers fire just a few times a second -- fine for captions sync, but
  // far too coarse for a smooth zoom or playhead: driving either off it
  // produced a visible step-then-jump (and, combined with the transition
  // below re-triggering on every irregular update, occasional flicker).
  // Polling the video element directly every animation frame gives a true
  // ~60fps clock for both to track instead. Also drives the live
  // playbackRate so scrubbing/playing through a sped-up or slowed-down clip
  // sounds/looks right in the editor, not just in the export, and the
  // timeline store's `playheadMs` (CutTimeline's `Playhead` reads it
  // directly, isolated into its own component so this doesn't cascade a
  // 60fps re-render through the rest of the timeline).
  const [zoomTimeMs, setZoomTimeMs] = useState(currentTimeMs);
  useEffect(() => {
    let rafId: number;
    const tick = (): void => {
      const video = videoRef.current;
      if (video) {
        const sourceMs = video.currentTime * 1000;
        setZoomTimeMs(sourceMs);
        if (!isHoverScrubbingRef.current) setPlayhead(sourceMs);
        const activeSegment = segmentsRef.current.find(
          (s) => sourceMs >= s.range.startMs && sourceMs < s.range.endMs
        );
        const targetRate = activeSegment?.speed ?? 1;
        if (video.playbackRate !== targetRate) video.playbackRate = targetRate;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stageRef = useRef<HTMLDivElement>(null);
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  // Cursor/webcam/annotation sizes are authored in REFERENCE_CANVAS_WIDTH
  // units and scaled against the stage's actual rendered width -- same
  // convention `handleWebcamDrag` below already uses.
  const [stageWidthPx, setStageWidthPx] = useState(0);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      setStageWidthPx(entries[0]?.contentRect.width ?? 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const dragState = useRef<{
    startClientX: number;
    startClientY: number;
    startPos: { x: number; y: number };
  } | null>(null);

  const activeCaption = captionsEnabled
    ? captionSegments.find((s) => currentTimeMs >= s.startMs && currentTimeMs <= s.endMs)
    : undefined;

  // Same resolveZoom() as the export compositor, so scrubbing shows exactly
  // what will get baked into the export. Uses the rAF-driven zoomTimeMs
  // (see above), not the coarser currentTimeMs prop, so it updates smoothly.
  const {
    depth: zoomDepth,
    focal: zoomFocal,
    shift: zoomShift
  } = useMemo(
    () => resolveZoom(zoomTimeMs, zoomKeyframes, smoothedCursorPath),
    [zoomTimeMs, zoomKeyframes, smoothedCursorPath]
  );
  // Where the focal point actually ends up on screen right now (it migrates
  // toward center as the zoom deepens, see zoom-resolve.ts) -- for the marker.
  const zoomFocalScreenX = zoomFocal.x + zoomShift.x;
  const zoomFocalScreenY = zoomFocal.y + zoomShift.y;

  function handlePreviewClick(event: React.MouseEvent<HTMLDivElement>): void {
    if (!armedKeyframeId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    updateKeyframe(armedKeyframeId, { position: { x, y } });
    disarmPositioning();
  }

  function startWebcamDrag(event: React.PointerEvent): void {
    event.preventDefault();
    beginGesture();
    dragState.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPos: webcam.position
    };
    window.addEventListener('pointermove', handleWebcamDrag);
    window.addEventListener('pointerup', stopWebcamDrag, { once: true });
  }

  function handleWebcamDrag(event: PointerEvent): void {
    const drag = dragState.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const scale = stage.getBoundingClientRect().width / REFERENCE_CANVAS_WIDTH;
    const dx = (event.clientX - drag.startClientX) / scale;
    const dy = (event.clientY - drag.startClientY) / scale;
    webcam.setPosition({
      x: Math.round(drag.startPos.x + dx),
      y: Math.round(drag.startPos.y + dy)
    });
  }

  function stopWebcamDrag(): void {
    if (dragState.current) endGesture();
    dragState.current = null;
    window.removeEventListener('pointermove', handleWebcamDrag);
  }

  // Guards against the pointerup listener never firing (this stage
  // unmounts mid-drag) -- otherwise the gesture it opened would stay open
  // forever, silently swallowing every undo-tracked change made afterward.
  useEffect(() => {
    return () => {
      if (dragState.current) endGesture();
    };
  }, []);

  // The stage mirrors the export canvas: fixed to the selected export aspect
  // ratio (not just whatever shape the flex column happens to be), letting
  // the outer wrapper below center/letterbox it within the available area.
  const stageAspectRatio = ASPECT_RATIO_VALUES[exportAspectRatio];
  // The video wrapper mirrors `computeInnerRect` -- contain-fit to the
  // *source's own* aspect ratio (which may differ from the export canvas)
  // inside the padded stage. Before metadata loads there's nothing to
  // constrain yet, so it just falls back to filling the stage.
  const sourceAspectRatio = sourceResolution
    ? sourceResolution.width / sourceResolution.height
    : undefined;

  // Same REFERENCE_CANVAS_WIDTH-relative scaling convention as cursor/webcam
  // sizing, so corner radius and shadow read as the same physical size in
  // the editor as they do at export -- see frame-compositor.ts's `composite`
  // (canvas clip + shadow at `innerRect`) for the export-side mirror of this.
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
        className="relative isolate flex max-h-full max-w-full overflow-hidden rounded-xl"
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

        <span className="absolute left-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs">
          <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
          Source
        </span>

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
              ref={videoRef}
              key={previewUrl}
              src={previewUrl}
              className="h-full w-full object-contain"
              onLoadedMetadata={onLoadedMetadata}
              onPlay={onPlay}
              onPause={onPause}
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime * 1000)}
              onError={(e) => onError(mediaErrorMessage(e.currentTarget.error))}
            />

            {zoomDepth > 1.01 && (
              <div
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent shadow-[0_0_0_2px_rgba(0,0,0,0.5)]"
                style={{ left: `${zoomFocalScreenX * 100}%`, top: `${zoomFocalScreenY * 100}%` }}
              />
            )}

            {cropToolActive && sourceResolution && selectedSegmentId && (
              <CropOverlay
                key={selectedSegmentId}
                segmentId={selectedSegmentId}
                sourceWidth={sourceResolution.width}
                sourceHeight={sourceResolution.height}
              />
            )}

            {/* Blur/mask drawn *before* the cursor (both here and in
                frame-compositor.ts's composite()) so the cursor stays
                visible on top of a redacted region instead of getting
                blurred/masked away with it. */}
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
                // rAF-driven, not the coarser `currentTimeMs` prop -- same
                // reasoning as the zoom transform above, so the spring
                // smoothing in smoothCursorPath actually reads as smooth
                // instead of stepping a few times a second.
                currentTimeMs={zoomTimeMs}
                stageWidthPx={stageWidthPx}
              />
            )}
          </div>

          {videoError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center">
              <p className="text-sm font-medium text-red-400">Couldn&apos;t play this recording</p>
              <p className="max-w-xs text-xs text-white/50">{videoError}</p>
            </div>
          )}

          {!isPlaying && !videoError && !cropToolActive && (
            <button
              onClick={() => videoRef.current?.play()}
              className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70"
            >
              <Play size={26} fill="currentColor" />
            </button>
          )}

          {webcam.enabled && !cropToolActive && (
            <div
              onPointerDown={startWebcamDrag}
              className={cn(
                'absolute flex cursor-grab items-center justify-center border border-white/10 bg-white/5 text-xs text-white/60 backdrop-blur active:cursor-grabbing',
                webcam.shape === 'circle' && 'rounded-full',
                webcam.shape === 'rounded-square' && 'rounded-2xl',
                webcam.shape === 'square' && 'rounded-none'
              )}
              style={{
                left: webcam.position.x,
                top: webcam.position.y,
                width: webcam.size,
                height: webcam.size
              }}
            >
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Webcam
              </span>
            </div>
          )}

          {!cropToolActive && (
            <AnnotationOverlay currentTimeMs={zoomTimeMs} stageWidthPx={stageWidthPx} />
          )}
        </div>

        {activeCaption && (
          <p className="absolute inset-x-0 bottom-6 z-10 mx-auto max-w-[80%] rounded-xl bg-black/70 px-5 py-2.5 text-center text-lg font-medium text-white">
            {activeCaption.text}
          </p>
        )}
      </div>
    </div>
  );
}
