import '../preload/index.d.ts';
import type { RegionSelectCompletePayload, ScreenRect } from '@shared/capture-region';

let overlayReady = false;
let backdrop: HTMLImageElement | null = null;
let backdropObjectUrl: string | null = null;

function requireCanvas(): HTMLCanvasElement {
  const el = document.getElementById('canvas');
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error('Region select canvas missing');
  }
  return el;
}

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Region select canvas context missing');
  return context;
}

const canvas = requireCanvas();
const ctx = requireContext(canvas);

// Drawing math stays in CSS pixels; the backing store is devicePixelRatio-
// scaled. Without this the native-resolution backdrop is downsampled to CSS
// resolution (half on 2x displays), making the preview visibly blurrier than
// the final crop.
let cssWidth = window.innerWidth;
let cssHeight = window.innerHeight;

function resizeCanvas(): void {
  const dpr = window.devicePixelRatio || 1;
  cssWidth = window.innerWidth;
  cssHeight = window.innerHeight;
  canvas.width = Math.round(cssWidth * dpr);
  canvas.height = Math.round(cssHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  redraw();
}

function drawBackdrop(): void {
  if (!backdrop) return;
  ctx.drawImage(backdrop, 0, 0, cssWidth, cssHeight);
}

function redraw(active?: ScreenRect): void {
  ctx.clearRect(0, 0, cssWidth, cssHeight);
  drawBackdrop();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  if (!active) return;

  if (backdrop) {
    ctx.drawImage(
      backdrop,
      (active.x / cssWidth) * backdrop.naturalWidth,
      (active.y / cssHeight) * backdrop.naturalHeight,
      (active.width / cssWidth) * backdrop.naturalWidth,
      (active.height / cssHeight) * backdrop.naturalHeight,
      active.x,
      active.y,
      active.width,
      active.height
    );
  } else {
    ctx.clearRect(active.x, active.y, active.width, active.height);
  }

  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(active.x + 0.5, active.y + 0.5, active.width - 1, active.height - 1);
}

let dragStartClient: { x: number; y: number } | null = null;
let activeRect: ScreenRect | null = null;

function normalizedRect(startX: number, startY: number, endX: number, endY: number): ScreenRect {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  return {
    x,
    y,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };
}

function clientToImageRect(rect: ScreenRect): ScreenRect {
  if (!backdrop) return rect;
  const sx = backdrop.naturalWidth / cssWidth;
  const sy = backdrop.naturalHeight / cssHeight;
  return {
    x: Math.round(rect.x * sx),
    y: Math.round(rect.y * sy),
    width: Math.round(rect.width * sx),
    height: Math.round(rect.height * sy)
  };
}

function complete(payload: RegionSelectCompletePayload): void {
  window.screenRecorder?.regionSelect.complete(payload);
}

function cancel(): void {
  window.screenRecorder?.regionSelect.cancel();
}

async function loadBackdropFromPayload(payload: ArrayBuffer | string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('Failed to load region backdrop'));
    if (typeof payload === 'string') {
      image.src = payload;
      return;
    }
    const url = URL.createObjectURL(new Blob([payload], { type: 'image/jpeg' }));
    backdropObjectUrl = url;
    image.src = url;
  });
  return image;
}

async function initOverlay(): Promise<void> {
  document.body.style.pointerEvents = 'none';

  const payload = await window.screenRecorder?.regionSelect.getBackdrop();
  if (payload) {
    backdrop = await loadBackdropFromPayload(payload);
    // Image-space crop needs no content-origin settle wait.
    overlayReady = true;
    document.body.style.pointerEvents = 'auto';
    resizeCanvas();
    return;
  }

  await window.screenRecorder?.regionSelect.getContentOrigin();
  overlayReady = true;
  document.body.style.pointerEvents = 'auto';
  resizeCanvas();
}

canvas.addEventListener('pointerdown', (event) => {
  if (!overlayReady) return;
  dragStartClient = { x: event.clientX, y: event.clientY };
  activeRect = { x: event.clientX, y: event.clientY, width: 0, height: 0 };
  canvas.setPointerCapture(event.pointerId);
  redraw(activeRect);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragStartClient) return;
  activeRect = normalizedRect(dragStartClient.x, dragStartClient.y, event.clientX, event.clientY);
  redraw(activeRect);
});

canvas.addEventListener('pointerup', (event) => {
  if (!dragStartClient) return;
  const start = dragStartClient;
  dragStartClient = null;
  const clientRect = normalizedRect(start.x, start.y, event.clientX, event.clientY);
  canvas.releasePointerCapture(event.pointerId);

  if (clientRect.width < 4 || clientRect.height < 4) {
    activeRect = null;
    redraw();
    return;
  }

  if (backdrop) {
    const imageRect = clientToImageRect(clientRect);
    complete({
      rect: imageRect,
      imageSpace: true,
      imageWidth: backdrop.naturalWidth,
      imageHeight: backdrop.naturalHeight
    });
    return;
  }

  complete(clientRect);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') cancel();
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('pagehide', () => {
  if (backdropObjectUrl) URL.revokeObjectURL(backdropObjectUrl);
});
void initOverlay();
