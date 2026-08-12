import type { RefObject } from 'react';
import { useAppStore } from '../../app/app-store';
import { useWebcamStore } from '../../features/webcam/store/webcam-store';
import { useWebcamDrag } from './hooks/use-webcam-drag';
import { cn } from '../../lib/utils';

interface WebcamPipProps {
  stageRef: RefObject<HTMLDivElement | null>;
  webcamVideoRef: RefObject<HTMLVideoElement | null>;
  previewScale: number;
  /** The clip currently under the playhead's own per-segment "Hide webcam" flag (see CutTimeline.tsx's context menu) -- independent of `webcam.enabled`, which hides it everywhere instead of just this one clip. */
  webcamHidden?: boolean;
}

export default function WebcamPip({
  stageRef,
  webcamVideoRef,
  previewScale,
  webcamHidden = false
}: WebcamPipProps) {
  const webcam = useWebcamStore();
  const webcamPreviewUrl = useAppStore((s) => s.lastRecording?.webcamPreviewUrl ?? null);
  const { startWebcamDrag } = useWebcamDrag({
    stageRef,
    position: webcam.position,
    setPosition: webcam.setPosition
  });

  if (!webcam.enabled || !webcamPreviewUrl || webcamHidden) return null;

  // Same formula as PreviewStage.tsx's `contentBoxShadow` -- CSS box-shadow
  // isn't clipped by this same element's own `overflow-hidden` (that only
  // clips its content, not shadows the box itself casts), so no extra
  // unclipped layer is needed here the way the PixiJS export renderer
  // (webcam.ts's `shadowGraphics`) needs one to get around `container.mask`.
  const webcamBoxShadow =
    webcam.shadow > 0
      ? `0 0 ${Math.round(webcam.shadow * 0.7 * previewScale)}px ${Math.round(webcam.shadow * 0.3 * previewScale)}px rgba(0, 0, 0, ${(0.15 + (webcam.shadow / 100) * 0.45).toFixed(2)})`
      : 'none';
  // Matches webcam.ts's `traceShape` (`size * 0.16`) exactly -- the fixed
  // Tailwind `rounded-2xl` this used to be (16px regardless of `webcam.size`
  // or `previewScale`) doesn't scale the way every other radius in this app
  // does, so its corner grew relatively sharper than the export's at larger
  // sizes and was never in the same place at all once a shadow started
  // tracing around it.
  const webcamBorderRadius =
    webcam.shape === 'rounded-square' ? webcam.size * previewScale * 0.16 : undefined;

  return (
    <div
      onPointerDown={startWebcamDrag}
      className={cn(
        'absolute cursor-grab overflow-hidden border border-white/10 bg-black/40 active:cursor-grabbing',
        webcam.shape === 'circle' && 'rounded-full',
        webcam.shape === 'square' && 'rounded-none'
      )}
      style={{
        left: webcam.position.x * previewScale,
        top: webcam.position.y * previewScale,
        width: webcam.size * previewScale,
        height: webcam.size * previewScale,
        borderRadius: webcamBorderRadius,
        boxShadow: webcamBoxShadow
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
  );
}
