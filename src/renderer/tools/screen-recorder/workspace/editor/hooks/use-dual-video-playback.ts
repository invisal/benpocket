import { useEffect, useRef, useState, type RefObject, type SyntheticEvent } from 'react';
import type { TimelineSegment } from '@screen-recorder/types/timeline';
import type { PreviewVideoController } from '@screen-recorder/types/editor';
import { mediaErrorMessage } from '../../../lib/media';
import { PENDING_SWAP_TIMEOUT_MS, PLAYBACK_STALL_RECOVERY_MS } from '../editorTools';

interface UseDualVideoPlaybackOptions {
  videoRef: RefObject<PreviewVideoController | null>;
  segments: TimelineSegment[];
  setPlayhead: (ms: number, isJump?: boolean) => void;
  isHoverScrubbing: boolean;
  currentTimeMs: number;
  webcamVideoRef: RefObject<HTMLVideoElement | null>;
  webcamPreviewUrl: string | null;
  webcamOffsetMs: number;
  onPlay: () => void;
  onPause: () => void;
  onError: (message: string) => void;
  onTimeUpdate: (currentTimeMs: number) => void;
  onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

interface UseDualVideoPlaybackResult {
  videoARef: RefObject<HTMLVideoElement | null>;
  videoBRef: RefObject<HTMLVideoElement | null>;
  isSlotAActive: boolean;
  isVideoReady: boolean;
  zoomTimeMs: number;
  handleVideoLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) => void;
  handleVideoPlay: (event: SyntheticEvent<HTMLVideoElement>) => void;
  handleVideoPause: (event: SyntheticEvent<HTMLVideoElement>) => void;
  handleVideoTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) => void;
  handleVideoError: (event: SyntheticEvent<HTMLVideoElement>) => void;
}

export function useDualVideoPlayback({
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
}: UseDualVideoPlaybackOptions): UseDualVideoPlaybackResult {
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const activeSlotRef = useRef<'a' | 'b'>('a');
  const [activeSlot, setActiveSlot] = useState<'a' | 'b'>('a');
  const [isVideoReady, setIsVideoReady] = useState(false);

  function getActiveVideo(): HTMLVideoElement | null {
    return activeSlotRef.current === 'a' ? videoARef.current : videoBRef.current;
  }
  function getStandbyVideo(): HTMLVideoElement | null {
    return activeSlotRef.current === 'a' ? videoBRef.current : videoARef.current;
  }

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

  const segmentsRef = useRef(segments);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const activeSegmentIdRef = useRef<string | null>(null);
  const standbySegmentIdRef = useRef<string | null>(null);
  const pendingSwapTargetIdRef = useRef<string | null>(null);
  const pendingSwapSinceRef = useRef(0);
  // Tracks the last tick where `sourceMs` actually moved while the active
  // video reported itself as playing -- lets the tick loop notice a stalled
  // decoder (see `PLAYBACK_STALL_RECOVERY_MS`) instead of waiting forever on
  // a `currentTime` that will never advance.
  const stallWatchRef = useRef({ sourceMs: 0, sinceMs: 0 });

  useEffect(() => {
    if (videoBRef.current) videoBRef.current.muted = true;
  }, []);

  const isHoverScrubbingRef = useRef(isHoverScrubbing);
  useEffect(() => {
    isHoverScrubbingRef.current = isHoverScrubbing;
  }, [isHoverScrubbing]);

  const [zoomTimeMs, setZoomTimeMs] = useState(currentTimeMs);

  useEffect(() => {
    let rafId: number;
    const tick = (): void => {
      let active = getActiveVideo();
      if (active) {
        const segs = segmentsRef.current;
        let sourceMs = active.currentTime * 1000;
        // Only true on ticks where playback actually crossed a cut boundary
        // this frame (a swap happened, a hard-seek timeout fired, or we
        // looped back to the start) -- i.e. `sourceMs` is about to jump
        // discontinuously rather than advance from the real decoded frame.
        // Threaded into `setPlayhead` so the timeline UI only glides across
        // real jumps, never during continuous playback or manual scrubs.
        let jumped = false;
        const currentIndex = segs.findIndex(
          (s) => sourceMs >= s.range.startMs && sourceMs < s.range.endMs
        );

        if (currentIndex !== -1) {
          activeSegmentIdRef.current = segs[currentIndex].id;

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
        } else if (pendingSwapTargetIdRef.current !== null) {
          const nextSegment = segs.find((s) => s.id === pendingSwapTargetIdRef.current);
          if (!nextSegment) {
            pendingSwapTargetIdRef.current = null;
            void active.play();
          } else {
            const standby = getStandbyVideo();
            const standbyReady =
              standby &&
              standbySegmentIdRef.current === nextSegment.id &&
              !standby.seeking &&
              standby.readyState >= standby.HAVE_CURRENT_DATA;
            const timedOut =
              performance.now() - pendingSwapSinceRef.current > PENDING_SWAP_TIMEOUT_MS;
            if (standbyReady && standby) {
              active.pause();
              // Corrected to the real per-segment mute state a few lines
              // below, right after `activeSegmentIdRef.current` is updated
              // to this now-active video's segment -- just needs to start
              // out silent for the instant in between.
              standby.muted = true;
              void standby.play();
              activeSlotRef.current = activeSlotRef.current === 'a' ? 'b' : 'a';
              setActiveSlot(activeSlotRef.current);
              active = standby;
              activeSegmentIdRef.current = nextSegment.id;
              standbySegmentIdRef.current = null;
              pendingSwapTargetIdRef.current = null;
              sourceMs = nextSegment.range.startMs;
              jumped = true;
            } else if (timedOut) {
              active.currentTime = nextSegment.range.startMs / 1000;
              void active.play();
              activeSegmentIdRef.current = nextSegment.id;
              standbySegmentIdRef.current = null;
              pendingSwapTargetIdRef.current = null;
              sourceMs = nextSegment.range.startMs;
              jumped = true;
            }
            // Still waiting on the standby to become ready -- `sourceMs`
            // stays at the paused `active` video's real (frozen) frame
            // rather than jumping ahead to the next segment's start, so the
            // playhead/zoom transform don't get ahead of what's on screen.
          }
        } else if (!active.paused && !active.seeking && segs.length > 0) {
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
              active.pause();
              // Corrected to the real per-segment mute state a few lines
              // below, right after `activeSegmentIdRef.current` is updated
              // to this now-active video's segment -- just needs to start
              // out silent for the instant in between.
              standby.muted = true;
              void standby.play();
              activeSlotRef.current = activeSlotRef.current === 'a' ? 'b' : 'a';
              setActiveSlot(activeSlotRef.current);
              active = standby;
              activeSegmentIdRef.current = nextSegment.id;
              standbySegmentIdRef.current = null;
              sourceMs = nextSegment.range.startMs;
              jumped = true;
            } else {
              pendingSwapTargetIdRef.current = nextSegment.id;
              pendingSwapSinceRef.current = performance.now();
              active.pause();
              if (standby && standbySegmentIdRef.current !== nextSegment.id) {
                standby.muted = true;
                standby.pause();
                standby.currentTime = nextSegment.range.startMs / 1000;
                standby.playbackRate = nextSegment.speed;
                standbySegmentIdRef.current = nextSegment.id;
              }
              // Standby isn't ready yet -- leave `sourceMs` at the just-paused
              // `active` video's real overshoot position instead of jumping
              // ahead, matching the pending-swap branch above.
            }
          } else {
            active.pause();
            active.currentTime = segs[0].range.startMs / 1000;
            activeSegmentIdRef.current = segs[0].id;
            standbySegmentIdRef.current = null;
            sourceMs = segs[0].range.startMs;
            jumped = true;
          }
        }

        // Stall watchdog: `active.paused === false` only means we *asked* it
        // to play, not that frames are actually advancing -- a hard seek
        // that lands off a keyframe can leave the decoder stuck with
        // `currentTime` frozen forever, which none of the branches above can
        // detect on their own (they only reason about *whose* video is
        // active, not whether it's actually decoding). Detect no forward
        // progress for `PLAYBACK_STALL_RECOVERY_MS` and re-kick the same
        // video with a fresh seek, which typically un-sticks it.
        const watch = stallWatchRef.current;
        if (active.paused || Math.abs(sourceMs - watch.sourceMs) > 1) {
          watch.sourceMs = sourceMs;
          watch.sinceMs = performance.now();
        } else if (performance.now() - watch.sinceMs > PLAYBACK_STALL_RECOVERY_MS) {
          active.currentTime = sourceMs / 1000;
          void active.play();
          watch.sinceMs = performance.now();
        }

        setZoomTimeMs(sourceMs);
        if (!isHoverScrubbingRef.current) setPlayhead(sourceMs, jumped);
        const activeSegment = segs.find((s) => s.id === activeSegmentIdRef.current);
        const targetRate = activeSegment?.speed ?? 1;
        if (active.playbackRate !== targetRate) active.playbackRate = targetRate;
        // Runs every tick (not just at swap points) so a mute toggled via the
        // clip's own context menu while it's already the one playing takes
        // effect immediately, not just on the next cut boundary.
        const shouldMute = Boolean(activeSegment?.audioMuted);
        if (active.muted !== shouldMute) active.muted = shouldMute;

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

  function handleVideoPlay(event: SyntheticEvent<HTMLVideoElement>): void {
    if (event.currentTarget === getActiveVideo()) onPlay();
  }
  function handleVideoPause(event: SyntheticEvent<HTMLVideoElement>): void {
    if (event.currentTarget === getActiveVideo()) onPause();
  }
  function handleVideoTimeUpdate(event: SyntheticEvent<HTMLVideoElement>): void {
    if (event.currentTarget === getActiveVideo())
      onTimeUpdate(event.currentTarget.currentTime * 1000);
  }
  function handleVideoError(event: SyntheticEvent<HTMLVideoElement>): void {
    if (event.currentTarget === getActiveVideo())
      onError(mediaErrorMessage(event.currentTarget.error));
  }
  function handleVideoLoadedMetadata(event: SyntheticEvent<HTMLVideoElement>): void {
    setIsVideoReady(true);
    onLoadedMetadata(event);
  }

  return {
    videoARef,
    videoBRef,
    isSlotAActive: activeSlot === 'a',
    isVideoReady,
    zoomTimeMs,
    handleVideoLoadedMetadata,
    handleVideoPlay,
    handleVideoPause,
    handleVideoTimeUpdate,
    handleVideoError
  };
}
