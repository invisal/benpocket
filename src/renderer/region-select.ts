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
if (confirmLabel) document.documentElement.classList.add('confirm-mode');
const panel = document.getElementById('panel');
const widthInput = document.getElementById('width-input');
const heightInput = document.getElementById('height-input');
const xInput = document.getElementById('x-input');
const yInput = document.getElementById('y-input');
const confirmButton = document.getElementById('confirm-button');
if (confirmButton && confirmLabel) confirmButton.textContent = confirmLabel;

// Same confirm-mode gate as the panel above -- Screen Capture's region
// screenshot has no equivalent instruction and keeps its plain crosshair.
const hint = document.getElementById('hint');
const hintMessage = document.getElementById('hint-message');
if (hintMessage && confirmLabel) hintMessage.textContent = 'Drag area you want to record';

function showHint(): void {
  if (hint && confirmLabel) hint.hidden = false;
}

function hideHint(): void {
  if (hint) hint.hidden = true;
}

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

// Keeps the rect inside the overlay and above the same too-small threshold
// pointerup already enforces for a drag -- applies equally to a typed
// value, since nothing else validates what the user enters.
function clampRect(rect: ScreenRect): ScreenRect {
  const width = Math.min(Math.max(rect.width, 4), cssWidth);
  const height = Math.min(Math.max(rect.height, 4), cssHeight);
  const x = Math.min(Math.max(rect.x, 0), cssWidth - width);
  const y = Math.min(Math.max(rect.y, 0), cssHeight - height);
  return { x, y, width, height };
}

function writeInputsFromRect(rect: ScreenRect): void {
  if (widthInput instanceof HTMLInputElement) widthInput.value = String(Math.round(rect.width));
  if (heightInput instanceof HTMLInputElement) heightInput.value = String(Math.round(rect.height));
  if (xInput instanceof HTMLInputElement) xInput.value = String(Math.round(rect.x));
  if (yInput instanceof HTMLInputElement) yInput.value = String(Math.round(rect.y));
}

function readRectFromInputs(): ScreenRect | null {
  if (
    !(widthInput instanceof HTMLInputElement) ||
    !(heightInput instanceof HTMLInputElement) ||
    !(xInput instanceof HTMLInputElement) ||
    !(yInput instanceof HTMLInputElement)
  ) {
    return null;
  }
  return {
    x: Number(xInput.value) || 0,
    y: Number(yInput.value) || 0,
    width: Number(widthInput.value) || 0,
    height: Number(heightInput.value) || 0
  };
}

// Centered on the rect -- inside it if there's room, otherwise tucked just
// below (or above, if there isn't room below either).
function positionPanel(rect: ScreenRect): void {
  if (!panel) return;

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

function showConfirmPanel(rect: ScreenRect): void {
  if (!panel) return;
  writeInputsFromRect(rect);
  panel.hidden = false;
  positionPanel(rect);
}

// Re-applied on blur/Enter (see the 'change' listeners below) rather than
// live on every keystroke -- an 'input' listener would snap the drawn
// selection to width:4 mid-edit any time the field goes briefly empty
// (e.g. selecting "300" to retype "250").
function applyInputsToRect(): void {
  const raw = readRectFromInputs();
  if (!raw) return;
  const rect = clampRect(raw);
  confirmedRect = rect;
  writeInputsFromRect(rect);
  redraw(rect);
  positionPanel(rect);
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
    showHint();
    return;
  }

  await window.screenRecorder?.regionSelect.getContentOrigin();
  overlayReady = true;
  document.body.style.pointerEvents = 'auto';
  resizeCanvas();
  showHint();
}

canvas.addEventListener('pointerdown', (event) => {
  if (!overlayReady) return;
  hideHint();
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
    showHint();
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

for (const input of [widthInput, heightInput, xInput, yInput]) {
  if (!(input instanceof HTMLInputElement)) continue;
  input.addEventListener('change', applyInputsToRect);
  // Enter doesn't fire 'change' on its own until the field loses focus.
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') input.blur();
  });
}

window.addEventListener('keydown', (event) => {
  // Editing a Size/Position field: Escape clears focus instead of
  // cancelling the whole picker -- the field's own last applied value
  // (not necessarily whatever's still typed) stays in effect either way.
  if (event.key === 'Escape' && document.activeElement instanceof HTMLInputElement) {
    document.activeElement.blur();
    return;
  }
  if (event.key === 'Escape') cancel();
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('pagehide', () => {
  if (backdropObjectUrl) URL.revokeObjectURL(backdropObjectUrl);
});
void initOverlay();
