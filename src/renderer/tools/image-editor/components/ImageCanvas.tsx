import { useEffect, useRef, type ReactNode } from 'react';
import cn from 'cnfast';

interface ImageCanvasProps {
  imageData: ImageData;
  /** Overlay content (crop handles, mask brush canvas) positioned to exactly cover the rendered canvas. */
  children?: ReactNode;
  className?: string;
}

/**
 * Renders `imageData` at native pixel size, scaled down to fit via CSS (like `object-contain`) --
 * the wrapper is `inline-block` so it shrinks to the canvas's rendered box, letting overlays
 * (crop handles, mask brush) position themselves with `absolute inset-0` and stay pixel-aligned.
 * Each tool mounts its own instance of this rather than sharing one.
 */
export function ImageCanvas({ imageData, children, className }: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    ctx?.putImageData(imageData, 0, 0);
  }, [imageData]);

  return (
    <div
      className={cn(
        'flex flex-1 items-center justify-center overflow-auto bg-dotted p-3',
        className
      )}
    >
      <div className="relative inline-block max-h-full max-w-full">
        <canvas
          ref={canvasRef}
          className="block max-h-full max-w-full"
          style={{ width: 'auto', height: 'auto' }}
        />
        {children}
      </div>
    </div>
  );
}
