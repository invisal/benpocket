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

/**
 * The play/pause/seek surface EditorPage and EditorTransportBar drive
 * playback through -- deliberately not a raw `HTMLVideoElement`, since
 * PreviewStage actually runs *two* `<video>` elements internally (see the
 * tick loop below) and which one is "the" active video changes every time
 * a cut swaps to the pre-buffered standby. Assigned once, see the effect
 * near the top of PreviewStage.
 */
export interface PreviewVideoController {
  readonly paused: boolean;
  readonly duration: number;
  currentTime: number;
  play(): void;
  pause(): void;
}

interface PreviewStageProps {
  videoRef: RefObject<PreviewVideoController | null>;
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
  const webcamPreviewUrl = useAppStore((s) => s.lastRecording?.webcamPreviewUrl ?? null);
  const webcamOffsetMs = useAppStore((s) => s.lastRecording?.webcamOffsetMs ?? 0);
  const webcamVideoRef = useRef<HTMLVideoElement>(null);
  // Same smoothing pass the export compositor applies (see
  // FrameCompositor.create), so 'auto-cursor' zoom keyframes and the export
  // follow the identical (smoothed) trajectory.
  const smoothedCursorPath = useMemo(
    () => smoothCursorPath(rawCursorPath, cursorSmoothing),
    [rawCursorPath, cursorSmoothing]
  );

  // Both `<video>` elements always hold the raw, uncut source, so playback
  // has to actively ripple over cut-out stretches itself -- when the tick
  // loop below notices playback has run off the end of the segment it was
  // in (either a ripple-closed gap or a deleted clip's leftover footage),
  // it needs to jump straight to the next kept segment's own start instead
  // of letting the video keep rolling through footage that isn't part of
  // the output. A single video element can't do that jump *instantly*,
  // though -- seeking on a delta-compressed codec means decoding forward
  // from the nearest keyframe, which flickers through a few wrong frames
  // first. So there are two elements: one plays while the other silently
  // pre-seeks ("stands by") at the *next* kept segment's start, fully
  // decoded and paused, well ahead of actually needing it (using however
  // much of the current segment is left as lead time). At the cut, the tick
  // loop just swaps which element is visible and playing -- no seek delay
  // in the moment, so no flicker. `activeSlotRef` tracks which one is
  // currently "the" video for the tick loop's own dispatch (`getActiveVideo`
  // /`getStandbyVideo`) -- a ref, not state, so a swap takes effect within
  // the same tick without waiting on a render. `activeSlot` state mirrors
  // it purely for the JSX below (which video is visible), since reading a
  // ref during render isn't safe -- kept in sync with the ref immediately
  // wherever the ref changes.
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeSlotRef = useRef<'a' | 'b'>('a');
  const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a');
  function getActiveVideo(): HTMLVideoElement | null {
    return activeSlotRef.current === 'a' ? videoARef.current : videoBRef.current;
  }
  function getStandbyVideo(): HTMLVideoElement | null {
    return activeSlotRef.current === 'a' ? videoBRef.current : videoARef.current;
  }

  // EditorPage/EditorTransportBar drive playback through this plain
  // play/pause/seek surface rather than a raw element, since which actual
  // `<video>` is "the" video changes at runtime (see above). Assigned once
  // -- the getters/setters dispatch to whichever is active *at call time*,
  // so the object itself never needs to change.
  useEffect(() => {
    videoRef.current = {
      get paused() {
        return getActiveVideo()?.paused ?? true;
      },
      get duration() {
        return getActiveVideo()?.duration ?? 0;
      },
      get currentTime() {
        return getActiveVideo()?.currentTime ?? 0;
      },
      set currentTime(value: number) {
        const video = getActiveVideo();
        if (video) video.currentTime = value;
      },
      play() {
        getActiveVideo()?.play();
      },
      pause() {
        getActiveVideo()?.pause();
      }
    };
  }, [videoRef]);

  const segments = useTimelineStore(
    (s) => s.tracks.find((t) => t.id === PRIMARY_VIDEO_TRACK_ID)?.segments ?? []
  );
  const setPlayhead = useTimelineStore((s) => s.setPlayhead);
  const activeTool = useTimelineStore((s) => s.activeTool);
  const segmentsRef = useRef(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);
  // Which kept segment the tick loop below believes is currently playing,
  // tracked by id (not array index) so a mid-playback split/delete/reorder
  // still resolves correctly against the live `segments` array each tick.
  const activeSegmentIdRef = useRef<string | null>(null);
  // Id of the segment the *standby* element is currently parked at the
  // start of -- lets the pre-buffer step below reseek it only when the
  // upcoming segment actually changes, not every frame.
  const standbySegmentIdRef = useRef<string | null>(null);

  // EditorPage keys the whole `<PreviewStage>` on `previewUrl`, so a
  // different recording loading remounts this component fresh -- all the
  // refs/state above already default to slot `a` active on a clean mount.
  // The one thing that still needs doing imperatively is parking the
  // initial standby (`b`) muted so it can't produce a stray blip before the
  // tick loop ever pre-buffers anything into it.
  useEffect(() => {
    if (videoBRef.current) videoBRef.current.muted = true;
  }, []);

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
      let active = getActiveVideo();
      if (active) {
        const segs = segmentsRef.current;
        let sourceMs = active.currentTime * 1000;
        const currentIndex = segs.findIndex(
          (s) => sourceMs >= s.range.startMs && sourceMs < s.range.endMs
        );

        if (currentIndex !== -1) {
          activeSegmentIdRef.current = segs[currentIndex].id;

          // Keep the standby element silently parked at wherever playback
          // will land next -- fully decoded and paused -- so the cut below
          // can swap to it instantly instead of seeking (and flickering
          // through the decode) in the moment. Only reseeks when the
          // *target* actually changes, not every frame, so it isn't
          // fighting its own seek continuously.
          const standby = getStandbyVideo();
          const upcoming = segs[currentIndex + 1];
          if (standby) {
            if (upcoming && standbySegmentIdRef.current !== upcoming.id) {
              standby.muted = true;
              standby.pause();
              standby.currentTime = upcoming.range.startMs / 1000;
              standby.playbackRate = upcoming.speed;
              standbySegmentIdRef.current = upcoming.id;
            } else if (!upcoming) {
              standbySegmentIdRef.current = null;
            }
          }
        } else if (!active.paused && !active.seeking && segs.length > 0) {
          // Landed outside every kept segment's range while still playing.
          // Only treat this as "the clip that was playing just ended" (and
          // ripple forward to whatever follows it in output order, by id so
          // this stays correct even if segments were split/deleted/reordered
          // mid-playback) when we've actually run off that clip's own *end*
          // -- otherwise this is a seek that landed cold in a gap (a
          // "Jump to start" behind a head-trimmed first clip, scrubbing
          // backward into a stretch that used to be a since-deleted clip,
          // ...), which has nothing to do with array-order continuation
          // from whatever happened to be playing before. That case instead
          // resumes at the next kept clip by raw source time.
          const prevIndex = segs.findIndex((s) => s.id === activeSegmentIdRef.current);
          const ranOffPrevEnd = prevIndex !== -1 && sourceMs >= segs[prevIndex].range.endMs;
          const nextSegment = ranOffPrevEnd
            ? segs[prevIndex + 1]
            : segs.find((s) => s.range.startMs >= sourceMs);

          if (nextSegment) {
            const standby = getStandbyVideo();
            if (
              standby &&
              standbySegmentIdRef.current === nextSegment.id &&
              !standby.seeking &&
              standby.readyState >= standby.HAVE_CURRENT_DATA
            ) {
              // Standby is already decoded and parked on the right frame --
              // swap which element is visible/playing instead of seeking,
              // so the cut lands instantly instead of flickering through
              // the decoder catching up.
              active.pause();
              standby.muted = false;
              void standby.play();
              activeSlotRef.current = activeSlotRef.current === 'a' ? 'b' : 'a';
              setActiveSlot(activeSlotRef.current);
              active = standby;
            } else {
              // Standby wasn't ready in time (a very short clip, or we
              // haven't had a chance to pre-seek yet) -- fall back to a
              // direct seek on the active element, same as the single-video
              // approach this replaces (may still flicker, but only in this
              // rare case).
              active.currentTime = nextSegment.range.startMs / 1000;
            }
            activeSegmentIdRef.current = nextSegment.id;
            standbySegmentIdRef.current = null;
            sourceMs = nextSegment.range.startMs;
          } else {
            // Nothing left to ripple to -- past the end of the last kept
            // clip, so stop instead of continuing to play trimmed-away
            // source footage. Also rewind to the very start (the first kept
            // segment's own startMs, not necessarily raw 0 if the head is
            // trimmed) rather than leaving playback sitting past the last
            // frame -- same "reached the end, ready to play again from the
            // top" behavior as any other player, and it keeps the Playhead
            // marker (see Playhead.tsx) pinned at a real, visible position
            // instead of one just past the last segment's own range.
            active.pause();
            active.currentTime = segs[0].range.startMs / 1000;
            activeSegmentIdRef.current = segs[0].id;
            standbySegmentIdRef.current = null;
            sourceMs = segs[0].range.startMs;
          }
        }

        setZoomTimeMs(sourceMs);
        if (!isHoverScrubbingRef.current) setPlayhead(sourceMs);
        const activeSegment = segs.find((s) => s.id === activeSegmentIdRef.current);
        const targetRate = activeSegment?.speed ?? 1;
        if (active.playbackRate !== targetRate) active.playbackRate = targetRate;

        // Free-running single element, not pre-buffered/dual-slotted like
        // the main video above -- a cut re-seeks it directly, which can
        // flicker briefly on this small PiP. Only correcting drift past
        // 150ms (rather than every frame) keeps it from fighting its own
        // playback with a seek on every tick.
        const webcamVideo = webcamVideoRef.current;
        if (webcamVideo && webcamPreviewUrl) {
          const targetSec = Math.max(0, (sourceMs + webcamOffsetMs) / 1000);
          if (Math.abs(webcamVideo.currentTime - targetSec) > 0.15) {
            webcamVideo.currentTime = targetSec;
          }
          if (active.playbackRate !== webcamVideo.playbackRate) {
            webcamVideo.playbackRate = active.playbackRate;
          }
          if (active.paused && !webcamVideo.paused) webcamVideo.pause();
          else if (!active.paused && webcamVideo.paused) void webcamVideo.play();
        }
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
      // `entries[0].contentRect` is the *content* box -- it excludes the
      // padding that's set directly on this element (`stageRef` doubles as
      // the padded canvas, see below), so it undercounts the true stage
      // width by the padding amount and drifts further from it as padding
      // increases. `borderBoxSize` (falling back to getBoundingClientRect,
      // which `handleWebcamDrag` already relies on for the same reason) is
      // the full box every reference-unit scale here needs to match.
      const borderBoxWidth = entries[0]?.borderBoxSize?.[0]?.inlineSize;
      setStageWidthPx(borderBoxWidth ?? el.getBoundingClientRect().width);
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

  // Both `<video>` elements below share these four handlers, filtered to
  // only forward events from whichever one is actually active right now --
  // the standby element fires its own `timeupdate`/`play`/`pause` as a side
  // effect of being silently pre-seeked and (briefly, at a swap) played/
  // paused in the tick loop above, and none of that should reach
  // EditorPage's `currentTimeMs`/`isPlaying` state or it'd show as a
  // flicker/jump in the UI even though the visible video stays smooth.
  function handleVideoPlay(event: React.SyntheticEvent<HTMLVideoElement>): void {
    if (event.currentTarget === getActiveVideo()) onPlay();
  }
  function handleVideoPause(event: React.SyntheticEvent<HTMLVideoElement>): void {
    if (event.currentTarget === getActiveVideo()) onPause();
  }
  function handleVideoTimeUpdate(event: React.SyntheticEvent<HTMLVideoElement>): void {
    if (event.currentTarget === getActiveVideo())
      onTimeUpdate(event.currentTarget.currentTime * 1000);
  }
  function handleVideoError(event: React.SyntheticEvent<HTMLVideoElement>): void {
    if (event.currentTarget === getActiveVideo())
      onError(mediaErrorMessage(event.currentTarget.error));
  }
  const isSlotAActive = activeSlot === 'a';

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
            {/*
              Two stacked video elements, not one -- see the tick loop
              above for why. Whichever is *active* stays a normal-flow
              replaced element (`h-full w-full object-contain`, exactly the
              single-video setup this replaced) so its own intrinsic size is
              still what lets `aspect-ratio` + `max-h-full`/`max-w-full`
              resolve this wrapper's box -- that anchor breaks if *both*
              videos go `absolute` (tried that; the whole stage collapses to
              0x0 with nothing in normal flow to size it from). Only the
              *standby* one is pulled out via `absolute inset-0` to stack
              invisibly on top, at `opacity-0` rather than `hidden`/`display:
              none` (which browsers use as a cue to stop decoding it --
              defeating the whole point of pre-buffering it in the
              background).
            */}
            <video
              ref={videoARef}
              key={`${previewUrl}-a`}
              src={previewUrl}
              className={cn(
                'h-full w-full object-contain',
                isSlotAActive ? '' : 'absolute inset-0 pointer-events-none opacity-0'
              )}
              onLoadedMetadata={onLoadedMetadata}
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
              onLoadedMetadata={onLoadedMetadata}
              onPlay={handleVideoPlay}
              onPause={handleVideoPause}
              onTimeUpdate={handleVideoTimeUpdate}
              onError={handleVideoError}
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
              className="absolute flex h-16 w-16 items-center justify-center rounded-full bg-surface/70 text-foreground shadow-lg backdrop-blur-sm transition-colors hover:bg-surface-2/80"
            >
              <Play size={26} fill="currentColor" />
            </button>
          )}

          {!cropToolActive && (
            <AnnotationOverlay currentTimeMs={zoomTimeMs} stageWidthPx={stageWidthPx} />
          )}
        </div>

        {webcam.enabled && webcamPreviewUrl && !cropToolActive && (
          <div
            onPointerDown={startWebcamDrag}
            className={cn(
              'absolute cursor-grab overflow-hidden border border-white/10 bg-black/40 active:cursor-grabbing',
              webcam.shape === 'circle' && 'rounded-full',
              webcam.shape === 'rounded-square' && 'rounded-2xl',
              webcam.shape === 'square' && 'rounded-none'
            )}
            style={{
              left: webcam.position.x * previewScale,
              top: webcam.position.y * previewScale,
              width: webcam.size * previewScale,
              height: webcam.size * previewScale
            }}
          >
            <video
              ref={webcamVideoRef}
              key={webcamPreviewUrl}
              src={webcamPreviewUrl}
              muted
              playsInline
              className={cn('h-full w-full object-cover', webcam.mirrored && 'scale-x-[-1]')}
            />
          </div>
        )}

        {activeCaption && (
          <p className="absolute inset-x-0 bottom-6 z-10 mx-auto max-w-[80%] rounded-xl bg-black/70 px-5 py-2.5 text-center text-lg font-medium text-white">
            {activeCaption.text}
          </p>
        )}
      </div>
    </div>
  );
}
