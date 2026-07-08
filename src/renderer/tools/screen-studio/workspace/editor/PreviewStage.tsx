import type { JSX } from 'react';
import { useRef, type RefObject } from 'react';
import { Play } from 'lucide-react';
import { useBackgroundStore } from '../../features/background/store/background-store';
import { backgroundLayerStyle } from '../../features/background/lib/background-css';
import { useWebcamStore } from '../../features/webcam/store/webcam-store';
import { useCaptionsStore } from '../../features/captions/store/captions-store';
import { CropOverlay } from '../../features/crop/components/CropOverlay';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
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

  const stageRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    startClientX: number;
    startClientY: number;
    startPos: { x: number; y: number };
  } | null>(null);

  const activeCaption = captionsEnabled
    ? captionSegments.find((s) => currentTimeMs >= s.startMs && currentTimeMs <= s.endMs)
    : undefined;

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
        <div className="relative max-h-full max-w-full overflow-hidden rounded-lg shadow-2xl shadow-black/50">
          <video
            ref={videoRef}
            key={previewUrl}
            src={previewUrl}
            className="max-h-full max-w-full"
            onLoadedMetadata={onLoadedMetadata}
            onPlay={onPlay}
            onPause={onPause}
            onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime * 1000)}
            onError={(e) => onError(mediaErrorMessage(e.currentTarget.error))}
          />

          {cropToolActive && sourceResolution && selectedSegmentId && (
            <CropOverlay
              key={selectedSegmentId}
              segmentId={selectedSegmentId}
              sourceWidth={sourceResolution.width}
              sourceHeight={sourceResolution.height}
            />
          )}
        </div>

        {videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 p-6 text-center">
            <p className="text-sm font-medium text-red-400">Couldn't play this recording</p>
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
