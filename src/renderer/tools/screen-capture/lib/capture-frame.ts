import type { CaptureSource } from '@screen-recorder/types/recording';
import type { CaptureRegionSelection, ScreenRect } from '@shared/capture-region';
import type { OsPickerSource } from '@shared/os-picker-source';

interface DesktopVideoConstraint {
  mandatory: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    maxWidth?: number;
    maxHeight?: number;
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

  // PipeWire sometimes omits displaySurface — treat near-full-display as monitor.
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

function waitForNextVideoFrame(video: HTMLVideoElement, staleOkMs?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      if (staleOkMs !== undefined) resolve();
      else reject(new Error('Capture video timed out'));
    }, staleOkMs ?? 5000);

    const done = (): void => {
      window.clearTimeout(timeout);
      resolve();
    };

    if (typeof video.requestVideoFrameCallback === 'function') {
      video.requestVideoFrameCallback(() => done());
      return;
    }

    video.addEventListener('playing', done, { once: true });
  });
}

async function grabPngFromStream(
  stream: MediaStream,
  options?: { skipFrames?: number; staleFrameMs?: number }
): Promise<Blob> {
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

    const skipFrames = options?.skipFrames ?? 0;
    const staleFrameMs = options?.staleFrameMs;
    for (let i = 0; i < skipFrames; i += 1) {
      await waitForNextVideoFrame(video, staleFrameMs);
    }

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

async function pickOsCaptureSource(monitorOnly: boolean): Promise<OsPickerSource | null> {
  return window.screenRecorder!.screenshot.pickOsSource({ monitorOnly });
}

function osPickerToCaptureSource(picked: OsPickerSource): CaptureSource {
  return {
    id: picked.id,
    name: picked.type === 'screen' ? 'Screen' : 'Window',
    type: picked.type,
    thumbnailDataUrl: '',
    displayId: picked.displayId,
    displayBounds: picked.displayBounds
  };
}

async function getDesktopVideoStream(
  source: CaptureSource,
  options?: { nativeResolution?: boolean }
): Promise<MediaStream> {
  const mandatory: DesktopVideoConstraint['mandatory'] = {
    chromeMediaSource: 'desktop',
    chromeMediaSourceId: source.id
  };

  if (!options?.nativeResolution) {
    const bounds = source.displayBounds;
    const scale = window.devicePixelRatio || 1;
    mandatory.maxWidth = Math.round((bounds?.width ?? window.screen.width) * scale);
    mandatory.maxHeight = Math.round((bounds?.height ?? window.screen.height) * scale);
  }

  const constraints: MediaStreamConstraints = {
    audio: false,
    video: {
      mandatory
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

  // Full-display capture uses main-process desktopCapturer (macOS/Windows/X11).
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
    if (shouldHideApp) await showApp({ focus: true });
  }
}

function regionSelectionForCrop(
  selection: CaptureRegionSelection,
  picked?: Pick<OsPickerSource, 'displayBounds' | 'scaleFactor'>
): CaptureRegionSelection {
  if (!picked?.displayBounds) return selection;
  return {
    ...selection,
    displayBounds: picked.displayBounds,
    scaleFactor: picked.scaleFactor ?? selection.scaleFactor
  };
}

function scaleMatchesFrame(
  displayBounds: ScreenRect,
  scaleFactor: number,
  frameWidth: number,
  frameHeight: number
): boolean {
  const expectedW = Math.round(displayBounds.width * scaleFactor);
  const expectedH = Math.round(displayBounds.height * scaleFactor);
  return Math.abs(frameWidth - expectedW) <= 2 && Math.abs(frameHeight - expectedH) <= 2;
}

function screenRectToPixelCrop(
  selection: CaptureRegionSelection,
  frameWidth: number,
  frameHeight: number
): ScreenRect {
  const { rect, displayBounds, scaleFactor = 1 } = selection;
  const relativeX = rect.x - displayBounds.x;
  const relativeY = rect.y - displayBounds.y;

  if (scaleFactor !== 1 && scaleMatchesFrame(displayBounds, scaleFactor, frameWidth, frameHeight)) {
    return {
      x: Math.round(relativeX * scaleFactor),
      y: Math.round(relativeY * scaleFactor),
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor)
    };
  }

  const scaleX = frameWidth / displayBounds.width;
  const scaleY = frameHeight / displayBounds.height;

  return {
    x: Math.round(relativeX * scaleX),
    y: Math.round(relativeY * scaleY),
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

export type RegionCaptureStep = 'picker' | 'region' | 'processing';

/** Drag a screen region, capture the matching display, and return a cropped PNG. */
export async function selectAndCaptureRegion(
  sources: CaptureSource[],
  usesOsPicker: boolean,
  onStep?: (step: RegionCaptureStep) => void
): Promise<Blob | null> {
  let picked: OsPickerSource | null = null;
  let portalStream: MediaStream | null = null;

  const stopPortalStream = (): void => {
    portalStream?.getTracks().forEach((track) => track.stop());
    portalStream = null;
  };

  try {
    if (usesOsPicker) {
      onStep?.('picker');
      picked = await pickOsCaptureSource(true);
      if (!picked) return null;
      if (picked.type !== 'screen') {
        throw new Error('Region capture requires a monitor. Choose a screen, not a window or tab.');
      }

      portalStream = await getDesktopVideoStream(osPickerToCaptureSource(picked), {
        nativeResolution: true
      });
    }

    onStep?.('region');
    await hideMainWindow();

    const selection = (await window.screenRecorder?.screenshot.selectRegion()) ?? null;
    if (!selection) return null;

    if (usesOsPicker) {
      onStep?.('processing');
      const fullBlob = await grabPngFromStream(portalStream!, {
        skipFrames: 1,
        staleFrameMs: 150
      });
      stopPortalStream();
      await showApp({ focus: true });
      return await cropPngBlob(fullBlob, regionSelectionForCrop(selection, picked ?? undefined));
    }

    await showApp({ focus: false });

    const source = findScreenSourceForRegion(sources, selection);
    if (!source) return null;

    onStep?.('processing');
    const fullBlob = await captureFromSource(source, { hideApp: false });
    return await cropPngBlob(fullBlob, selection);
  } catch (err) {
    if (err instanceof Error && err.message.includes('monitor')) throw err;
    return null;
  } finally {
    stopPortalStream();
    await showApp({ focus: true });
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
