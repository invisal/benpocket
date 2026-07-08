import type { JSX } from 'react';
import { useWebcamStore } from '../store/webcam-store';

// TODO: draggable/resizable PiP <video> bound to the selected webcam
// MediaStream, respecting shape (circle/rounded-square/square) and mirroring,
// with drag-to-position persisted to webcam-store.
export function WebcamOverlay(): JSX.Element | null {
  const { enabled, shape, position, size } = useWebcamStore();

  if (!enabled) return null;

  const shapeClass =
    shape === 'circle'
      ? 'rounded-full'
      : shape === 'rounded-square'
        ? 'rounded-2xl'
        : 'rounded-none';

  return (
    <div
      className={`absolute border-2 border-white/20 bg-black/60 ${shapeClass}`}
      style={{ left: position.x, top: position.y, width: size, height: size }}
    >
      {/* TODO: <video> element bound to webcam MediaStream, mirrored via scaleX(-1) */}
    </div>
  );
}
