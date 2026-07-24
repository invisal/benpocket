import '../preload/index.d.ts';
import type { RegionSelectCompletePayload, ScreenRect } from '@shared/capture-region';

let overlayReady = false;
let backdrop: HTMLImageElement | null = null;
let backdropObjectUrl: string | null = null;

// Screen Recorder's Area picker only (see SelectCaptureRegionOptions.
// confirmLabel) -- Screen Capture's region screenshot keeps the original
// complete-on-mouse-up behavior. When set, releasing the drag shows a
// Size/Position readout and this button instead of completing immediately,
// mirroring how picking a Display/Window starts recording right away
// (see RecorderToolbarApp.tsx's openSourcePicker).
const confirmLabel = new URLSearchParams(window.location.search).get('confirmLabel');
const panel = document.getElementById('panel');
const sizeValue = document.getElementById('size-value');
const positionValue = document.getElementById('position-value');
const confirmButton = document.getElementById('confirm-button');
if (confirmButton && confirmLabel) confirmButton.textContent = confirmLabel;

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
  activeRect = null;
  hidePanel();
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

  // Dashed accent border in confirm mode (Screen Recorder's Area picker) to
  // read as "still adjustable" alongside the panel/button; Screen Capture's
  // instant-complete flow keeps its original solid border.
  ctx.strokeStyle = confirmLabel ? '#89b4fa' : '#38bdf8';
  ctx.lineWidth = 2;
  ctx.setLineDash(confirmLabel ? [6, 4] : []);
  ctx.strokeRect(active.x + 0.5, active.y + 0.5, active.width - 1, active.height - 1);
  ctx.setLineDash([]);
}

let dragStartClient: { x: number; y: number } | null = null;
let activeRect: ScreenRect | null = null;
// Set once a drag ends in confirm mode -- what the confirm button's click
// handler below actually sends on.
let confirmedRect: ScreenRect | null = null;

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

function finishRect(clientRect: ScreenRect): void {
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
}

function hidePanel(): void {
  confirmedRect = null;
  if (panel) panel.hidden = true;
}

// Centered on the rect -- inside it if there's room, otherwise tucked just
// below (or above, if there isn't room below either).
function showConfirmPanel(rect: ScreenRect): void {
  if (!panel || !sizeValue || !positionValue) return;

  sizeValue.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)} px`;
  positionValue.textContent = `${Math.round(rect.x)}, ${Math.round(rect.y)} px`;
  panel.hidden = false;

  const { width: panelWidth, height: panelHeight } = panel.getBoundingClientRect();
  const centerX = rect.x + rect.width / 2;
  const left = Math.min(Math.max(centerX - panelWidth / 2, 8), cssWidth - panelWidth - 8);

  const margin = 12;
  const fitsInside = rect.height >= panelHeight + margin * 2;
  const top = fitsInside
    ? rect.y + rect.height / 2 - panelHeight / 2
    : Math.min(rect.y + rect.height + margin, cssHeight - panelHeight - 8);

  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(Math.max(top, 8))}px`;
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
  hidePanel();
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
    hidePanel();
    return;
  }

  if (confirmLabel) {
    confirmedRect = clientRect;
    showConfirmPanel(clientRect);
    return;
  }

  finishRect(clientRect);
});

confirmButton?.addEventListener('click', () => {
  if (confirmedRect) finishRect(confirmedRect);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') cancel();
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('pagehide', () => {
  if (backdropObjectUrl) URL.revokeObjectURL(backdropObjectUrl);
});
void initOverlay();
