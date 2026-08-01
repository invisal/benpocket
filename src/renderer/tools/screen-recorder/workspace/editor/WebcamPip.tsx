import type { RefObject } from 'react';
import { useAppStore } from '../../app/app-store';
import { useWebcamStore } from '../../features/webcam/store/webcam-store';
import { useWebcamDrag } from './hooks/use-webcam-drag';
import { cn } from '../../lib/utils';

interface WebcamPipProps {
  stageRef: RefObject<HTMLDivElement | null>;
  webcamVideoRef: RefObject<HTMLVideoElement | null>;
  previewScale: number;
  cropToolActive: boolean;
  /** The clip currently under the playhead's own per-segment "Hide webcam" flag (see CutTimeline.tsx's context menu) -- independent of `webcam.enabled`, which hides it everywhere instead of just this one clip. */
  webcamHidden?: boolean;
}

export default function WebcamPip({
  stageRef,
  webcamVideoRef,
  previewScale,
  cropToolActive,
  webcamHidden = false
}: WebcamPipProps) {
  const webcam = useWebcamStore();
  const webcamPreviewUrl = useAppStore((s) => s.lastRecording?.webcamPreviewUrl ?? null);
  const { startWebcamDrag } = useWebcamDrag({
    stageRef,
    position: webcam.position,
    setPosition: webcam.setPosition
  });

  if (!webcam.enabled || !webcamPreviewUrl || cropToolActive || webcamHidden) return null;

  return (
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
  );
}
