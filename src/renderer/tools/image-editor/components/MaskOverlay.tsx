import { useEffect, useRef } from 'react';

interface MaskOverlayProps {
  width: number;
  height: number;
  maskRef: React.RefObject<Uint8Array<ArrayBuffer>>;
  maskVersion: number;
  brushSize: number;
  /** Called once per paint stroke (pointer down or drag) -- lets a tool track "has anything been
   * painted" without polling the mask array. */
  onPaint?: () => void;
}

const PAINT_COLOR_CSS = 'rgba(239, 68, 68, 0.55)';
const PAINT_COLOR_RGB: [number, number, number] = [239, 68, 68];

/** Paints a hole mask (0 = keep, 1 = fill via inpainting) into the authoritative `maskRef` array
 * (pixel-indexed, same layout as the working `ImageData`) while drawing a translucent
 * visualization on its own overlay canvas. */
export function MaskOverlay({
  width,
  height,
  maskRef,
  maskVersion,
  brushSize,
  onPaint
}: MaskOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    const mask = maskRef.current;
    const overlay = ctx.createImageData(width, height);
    const [r, g, b] = PAINT_COLOR_RGB;
    for (let i = 0; i < width * height; i++) {
      if (mask[i] === 0) continue;
      overlay.data[i * 4] = r;
      overlay.data[i * 4 + 1] = g;
      overlay.data[i * 4 + 2] = b;
      overlay.data[i * 4 + 3] = 140;
    }
    ctx.putImageData(overlay, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, maskVersion]);

  function paintAt(clientX: number, clientY: number): void {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const bounds = canvas.getBoundingClientRect();
    const cx = Math.round(((clientX - bounds.left) / bounds.width) * width);
    const cy = Math.round(((clientY - bounds.top) / bounds.height) * height);
    const radius = brushSize;
    const mask = maskRef.current;

    ctx.fillStyle = PAINT_COLOR_CSS;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    const minY = Math.max(0, cy - radius);
    const maxY = Math.min(height - 1, cy + radius);
    const minX = Math.max(0, cx - radius);
    const maxX = Math.min(width - 1, cx + radius);
    const radiusSq = radius * radius;
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= radiusSq) mask[y * width + x] = 1;
      }
    }
    onPaint?.();
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
      onPointerDown={(e) => {
        // Left button only -- middle/right are reserved for panning (see ImageCanvas).
        if (e.button !== 0) return;
        isPainting.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        paintAt(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (isPainting.current) paintAt(e.clientX, e.clientY);
      }}
      onPointerUp={() => {
        isPainting.current = false;
      }}
      onPointerLeave={() => {
        isPainting.current = false;
      }}
    />
  );
}
