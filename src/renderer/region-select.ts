import '../preload/index.d.ts';
import type { ScreenRect } from '@shared/capture-region';

const params = new URLSearchParams(window.location.search);
let offsetX = Number(params.get('ox') ?? 0);
let offsetY = Number(params.get('oy') ?? 0);
let overlayReady = false;

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

function resizeCanvas(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  redraw();
}

function redraw(active?: ScreenRect): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!active) return;

  ctx.clearRect(active.x, active.y, active.width, active.height);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2;
  ctx.strokeRect(active.x + 0.5, active.y + 0.5, active.width - 1, active.height - 1);
}

let dragStart: { x: number; y: number } | null = null;
let activeRect: ScreenRect | null = null;

function clientRect(startX: number, startY: number, endX: number, endY: number): ScreenRect {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  return {
    x,
    y,
    width: Math.abs(endX - startX),
    height: Math.abs(endY - startY)
  };
}

function toScreenRect(rect: ScreenRect): ScreenRect {
  return {
    x: offsetX + rect.x,
    y: offsetY + rect.y,
    width: rect.width,
    height: rect.height
  };
}

function complete(rect: ScreenRect): void {
  window.screenRecorder?.regionSelect.complete(toScreenRect(rect));
}

function cancel(): void {
  window.screenRecorder?.regionSelect.cancel();
}

async function initOverlay(): Promise<void> {
  document.body.style.pointerEvents = 'none';

  const origin = await window.screenRecorder?.regionSelect.getContentOrigin();
  if (origin) {
    offsetX = origin.x;
    offsetY = origin.y;
  }

  overlayReady = true;
  document.body.style.pointerEvents = 'auto';
  resizeCanvas();
}

canvas.addEventListener('pointerdown', (event) => {
  if (!overlayReady) return;
  dragStart = { x: event.clientX, y: event.clientY };
  activeRect = { x: event.clientX, y: event.clientY, width: 0, height: 0 };
  canvas.setPointerCapture(event.pointerId);
  redraw(activeRect);
});

canvas.addEventListener('pointermove', (event) => {
  if (!dragStart) return;
  activeRect = clientRect(dragStart.x, dragStart.y, event.clientX, event.clientY);
  redraw(activeRect);
});

canvas.addEventListener('pointerup', (event) => {
  if (!dragStart) return;
  const start = dragStart;
  dragStart = null;
  const rect = clientRect(start.x, start.y, event.clientX, event.clientY);
  activeRect = rect;
  canvas.releasePointerCapture(event.pointerId);

  if (rect.width >= 4 && rect.height >= 4) {
    complete(rect);
    return;
  }

  activeRect = null;
  redraw();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') cancel();
});

window.addEventListener('resize', resizeCanvas);
void initOverlay();
