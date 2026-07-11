import type { CaptureSource } from '@screen-recorder/types/recording';
import type { CaptureRegionSelection, ScreenRect } from '@shared/capture-region';

interface DesktopVideoConstraint {
  mandatory: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    maxWidth: number;
    maxHeight: number;
  };
}

function isMonitorCapture(stream: MediaStream): boolean {
  const track = stream.getVideoTracks()[0];
  if (!track) return false;

  const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string };
  if (settings.displaySurface === 'monitor') return true;
  if (settings.displaySurface === 'window' || settings.displaySurface === 'application') {
    return false;
  }

  // ponytail: PipeWire sometimes omits displaySurface — treat near-full-display as monitor.
  const scale = window.devicePixelRatio || 1;
  const screenW = Math.round(window.screen.width * scale);
  const screenH = Math.round(window.screen.height * scale);
  const { width = 0, height = 0 } = settings;
  return width >= screenW * 0.9 && height >= screenH * 0.9;
}

async function hideApp(): Promise<void> {
  await window.screenRecorder?.window.hide();
}

async function hideMainWindow(): Promise<void> {
  await window.screenRecorder?.window.hide({ mainOnly: true });
}

async function showApp(options?: { focus?: boolean }): Promise<void> {
  await window.screenRecorder?.window.restore(options);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode screenshot'));
    }, 'image/png');
  });
}

function waitForVideoFrame(video: HTMLVideoElement): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onReady = (): void => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        cleanup();
        resolve();
      }
    };

    const onError = (): void => {
      cleanup();
      reject(new Error('Capture video failed to load'));
    };

    const cleanup = (): void => {
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
      video.removeEventListener('resize', onReady);
      video.removeEventListener('error', onError);
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
    video.addEventListener('resize', onReady);
    video.addEventListener('error', onError);
  });
}

async function grabPngFromStream(stream: MediaStream): Promise<Blob> {
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error('No video track in capture stream.');
  if (track.readyState === 'ended') throw new Error('Capture cancelled.');

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  Object.assign(video.style, {
    position: 'fixed',
    opacity: '0',
    width: '1px',
    height: '1px',
    pointerEvents: 'none'
  });
  document.body.appendChild(video);

  try {
    await video.play();
    await waitForVideoFrame(video);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Captured screenshot is empty.');
    }
    ctx.drawImage(video, 0, 0);

    return canvasToPngBlob(canvas);
  } finally {
    stream.getTracks().forEach((item) => item.stop());
    video.remove();
  }
}

async function getDesktopVideoStream(source: CaptureSource): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        maxWidth: window.screen.width * (window.devicePixelRatio || 1),
        maxHeight: window.screen.height * (window.devicePixelRatio || 1)
      }
    } as unknown as DesktopVideoConstraint as never
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}

async function captureDisplayPng(
  source: CaptureSource,
  options: { hideBeforeCapture: boolean }
): Promise<Blob> {
  const buffer = await window.screenRecorder!.screenshot.capture(source.id, {
    displayId: source.displayId,
    hideBeforeCapture: options.hideBeforeCapture,
    focusAfterRestore: true
  });
  return new Blob([buffer], { type: 'image/png' });
}

/** Grabs one PNG frame from a desktopCapturer source chosen in the in-app picker. */
export async function captureFromSource(
  source: CaptureSource,
  options?: { hideApp?: boolean }
): Promise<Blob> {
  const shouldHideApp = options?.hideApp ?? source.type === 'screen';

  // Full-display capture uses main-process desktopCapturer (all platforms).
  // Atomic hide → grab → restore avoids macOS renderer suspension during IPC.
  if (source.type === 'screen') {
    return captureDisplayPng(source, { hideBeforeCapture: shouldHideApp });
  }

  try {
    const stream = await getDesktopVideoStream(source);
    return await grabPngFromStream(stream);
  } finally {
    if (shouldHideApp) await showApp();
  }
}

async function openDisplayMediaStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getDisplayMedia({
      audio: false,
      video: {
        width: { ideal: window.screen.width * (window.devicePixelRatio || 1) },
        height: { ideal: window.screen.height * (window.devicePixelRatio || 1) }
      }
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotAllowedError') {
      throw new Error('Capture cancelled.');
    }
    throw err;
  }
}

/** Opens the OS capture picker (PipeWire portal on Linux Wayland), then grabs one PNG frame. */
export async function captureFromSystemPicker(): Promise<Blob> {
  const stream = await openDisplayMediaStream();
  const shouldHideApp = isMonitorCapture(stream);

  if (shouldHideApp) {
    await hideApp();
  }

  try {
    return await grabPngFromStream(stream);
  } finally {
    if (shouldHideApp) await showApp();
  }
}

function screenRectToPixelCrop(
  selection: CaptureRegionSelection,
  frameWidth: number,
  frameHeight: number
): ScreenRect {
  const { rect, displayBounds } = selection;
  const scaleX = frameWidth / displayBounds.width;
  const scaleY = frameHeight / displayBounds.height;

  return {
    x: Math.round((rect.x - displayBounds.x) * scaleX),
    y: Math.round((rect.y - displayBounds.y) * scaleY),
    width: Math.round(rect.width * scaleX),
    height: Math.round(rect.height * scaleY)
  };
}

function clampCrop(rect: ScreenRect, frameWidth: number, frameHeight: number): ScreenRect {
  const x = Math.max(0, Math.min(rect.x, frameWidth - 1));
  const y = Math.max(0, Math.min(rect.y, frameHeight - 1));
  const width = Math.max(1, Math.min(rect.width, frameWidth - x));
  const height = Math.max(1, Math.min(rect.height, frameHeight - y));
  return { x, y, width, height };
}

async function cropPngBlob(blob: Blob, selection: CaptureRegionSelection): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    const crop = clampCrop(
      screenRectToPixelCrop(selection, bitmap.width, bitmap.height),
      bitmap.width,
      bitmap.height
    );
    const canvas = document.createElement('canvas');
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to crop screenshot.');
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return canvasToPngBlob(canvas);
  } finally {
    bitmap.close();
  }
}

export function findScreenSourceForRegion(
  sources: CaptureSource[],
  selection: CaptureRegionSelection
): CaptureSource | null {
  const screens = sources.filter((source) => source.type === 'screen');
  const centerX = selection.rect.x + selection.rect.width / 2;
  const centerY = selection.rect.y + selection.rect.height / 2;

  const matched = screens.find((source) => {
    const bounds = source.displayBounds;
    if (!bounds) return false;
    return (
      centerX >= bounds.x &&
      centerX < bounds.x + bounds.width &&
      centerY >= bounds.y &&
      centerY < bounds.y + bounds.height
    );
  });

  return matched ?? screens[0] ?? null;
}

/** Drag a screen region, capture the matching display, and return a cropped PNG. */
export async function selectAndCaptureRegion(
  sources: CaptureSource[],
  usesOsPicker: boolean
): Promise<Blob | null> {
  await hideMainWindow();

  let selection: CaptureRegionSelection | null = null;
  try {
    selection = (await window.screenRecorder?.screenshot.selectRegion()) ?? null;
  } finally {
    // Restore main window after overlay closes (unfocused so the next grab is reliable).
    await showApp({ focus: false });
  }

  if (!selection) return null;

  try {
    if (usesOsPicker) {
      const fullBlob = await captureFromSystemPicker();
      const cropped = await cropPngBlob(fullBlob, selection);
      await showApp({ focus: true });
      return cropped;
    }

    const source = findScreenSourceForRegion(sources, selection);
    if (!source) return null;

    const fullBlob = await captureFromSource(source, { hideApp: false });
    const cropped = await cropPngBlob(fullBlob, selection);
    await showApp({ focus: true });
    return cropped;
  } catch {
    await showApp({ focus: true });
    return null;
  }
}

export function screenshotFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `screenshot-${stamp}.png`;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read captured image'));
    reader.readAsDataURL(blob);
  });
}
