import type { JSX } from 'react';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Play } from 'lucide-react';
import { useBackgroundStore } from '../../features/background/store/background-store';
import { backgroundLayerStyle } from '../../features/background/lib/background-css';
import { useWebcamStore } from '../../features/webcam/store/webcam-store';
import { useCaptionsStore } from '../../features/captions/store/captions-store';
import { useZoomStore } from '../../features/zoom/store/zoom-store';
import { useCursorStore } from '../../features/cursor/store/cursor-store';
import {
  useTimelineStore,
  PRIMARY_VIDEO_TRACK_ID
} from '../../features/timeline/store/timeline-store';
import { useAppStore } from '../../app/app-store';
import { CropOverlay } from '../../features/crop/components/CropOverlay';
// import { CursorOverlay } from '../../features/cursor/components/CursorOverlay';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { resolveZoom } from '@shared/zoom-resolve';
import { smoothCursorPath } from '@shared/cursor-path';
import { mediaErrorMessage } from '../../lib/media';
import { cn } from '../../lib/utils';

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
  const webcam = useWebcamStore();
  const captionSegments = useCaptionsStore((s) => s.segments);
  const captionsEnabled = useCaptionsStore((s) => s.enabled);
  const zoomKeyframes = useZoomStore((s) => s.keyframes);
  const armedKeyframeId = useZoomStore((s) => s.armedKeyframeId);
  const updateKeyframe = useZoomStore((s) => s.updateKeyframe);
  const disarmPositioning = useZoomStore((s) => s.disarmPositioning);
  // const cursor = useCursorStore();
  const cursorSmoothing = useCursorStore((s) => s.smoothing);
  const rawCursorPath = useAppStore((s) => s.lastRecording?.cursorPath ?? []);
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
  const segmentsRef = useRef(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // `currentTimeMs` only updates on the video's `timeupdate` event, which
  // browsers fire just a few times a second -- fine for captions/timeline
  // sync, but far too coarse for a smooth zoom: driving the transform off it
  // produced a visible step-then-jump (and, combined with the transition
  // below re-triggering on every irregular update, occasional flicker).
  // Polling the video element directly every animation frame gives a true
  // ~60fps clock for the zoom to track instead. Also drives the live
  // playbackRate so scrubbing/playing through a sped-up or slowed-down clip
  // sounds/looks right in the editor, not just in the export.
  const [zoomTimeMs, setZoomTimeMs] = useState(currentTimeMs);
  useEffect(() => {
    let rafId: number;
    const tick = (): void => {
      const video = videoRef.current;
      if (video) {
        const sourceMs = video.currentTime * 1000;
        setZoomTimeMs(sourceMs);
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
  // const [stageWidthPx, setStageWidthPx] = useState(0);

  // useEffect(() => {
  //   const el = stageRef.current;
  //   if (!el) return;
  //   const observer = new ResizeObserver((entries) => {
  //     setStageWidthPx(entries[0]?.contentRect.width ?? 0);
  //   });
  //   observer.observe(el);
  //   return () => observer.disconnect();
  // }, []);
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
    dragState.current = null;
    window.removeEventListener('pointermove', handleWebcamDrag);
  }

  return (
    <div
      ref={stageRef}
      className="relative isolate m-6 flex flex-1 overflow-hidden rounded-xl"
      style={{ padding: `${background.padding}%` }}
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
            'relative max-h-full max-w-full overflow-hidden rounded-lg shadow-2xl shadow-black/50',
            armedKeyframeId && 'cursor-crosshair'
          )}
        >
          <video
            ref={videoRef}
            key={previewUrl}
            src={previewUrl}
            className="max-h-full max-w-full"
            style={{
              transform: `translate(${zoomShift.x * 100}%, ${zoomShift.y * 100}%) scale(${zoomDepth})`,
              transformOrigin: `${zoomFocal.x * 100}% ${zoomFocal.y * 100}%`
            }}
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

          {/* {!cropToolActive && (
            <CursorOverlay
              cursor={cursor}
              rawPath={cursorPath}
              currentTimeMs={currentTimeMs}
              stageWidthPx={stageWidthPx}
            />
          )} */}
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
      </div>

      {activeCaption && (
        <p className="absolute inset-x-0 bottom-6 z-10 mx-auto max-w-[80%] rounded-xl bg-black/70 px-5 py-2.5 text-center text-lg font-medium text-white">
          {activeCaption.text}
        </p>
      )}
    </div>
  );
}
