import type { CaptureSource } from '@screen-recorder/types/recording';
import type { CaptureRegionSelection, ScreenRect } from '@shared/capture-region';

interface DesktopVideoConstraint {
  mandatory: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    maxWidth?: number;
    maxHeight?: number;
  };
}

async function hideMainWindow(): Promise<void> {
  await window.screenRecorder?.window.setBackgroundThrottling(false);
  await window.screenRecorder?.window.hide({ mainOnly: true });
}

async function showApp(options?: { focus?: boolean }): Promise<void> {
  await window.screenRecorder?.window.restore(options);
  await window.screenRecorder?.window.setBackgroundThrottling(true);
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode screenshot'));
    }, 'image/png');
  });
}

function waitForVideoFrame(video: HTMLVideoElement, timeoutMs = 2000): Promise<void> {
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      if (video.videoWidth > 0 && video.videoHeight > 0) resolve();
      else reject(new Error('Capture video timed out'));
    }, timeoutMs);

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
      window.clearTimeout(timer);
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

/** Legacy PNG grab for non-region callers. */
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

async function captureNativePng(
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

  // Full-display capture uses the main process (macOS screencapture /
  // elsewhere desktopCapturer). Atomic hide → grab → restore avoids macOS
  // renderer suspension during IPC.
  if (source.type === 'screen') {
    return captureNativePng(source, { hideBeforeCapture: shouldHideApp });
  }

  try {
    // macOS window stills: main-process `screencapture -l` gives a P3-tagged
    // PNG with no YUV round trip. Falls back to the stream grab on failure.
    if (window.api?.platform === 'darwin') {
      try {
        return await captureNativePng(source, { hideBeforeCapture: false });
      } catch (err) {
        console.warn('[capture] native window capture failed, using stream grab:', err);
      }
    }

    // Windows/X11 window stills keep the stream path despite its I420 chroma
    // subsampling: the only in-Electron alternative (desktopCapturer window
    // thumbnails) upscales to fit thumbnailSize (measured: an 800x536 px
    // window returned a 10000x7500 thumbnail), which looks worse. Fixing this
    // properly needs native capture (Windows.Graphics.Capture / XGetImage).
    const stream = await getDesktopVideoStream(source);
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
  const { rect, displayBounds, scaleFactor = 1, imageSpace } = selection;
  const relativeX = rect.x - displayBounds.x;
  const relativeY = rect.y - displayBounds.y;

  // Backdrop path: rect is already in bitmap pixels.
  if (imageSpace) {
    return {
      x: Math.round(relativeX),
      y: Math.round(relativeY),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
  }

  const expectedW = Math.round(displayBounds.width * scaleFactor);
  const expectedH = Math.round(displayBounds.height * scaleFactor);
  if (Math.abs(frameWidth - expectedW) <= 2 && Math.abs(frameHeight - expectedH) <= 2) {
    return {
      x: Math.round(relativeX * scaleFactor),
      y: Math.round(relativeY * scaleFactor),
      width: Math.round(rect.width * scaleFactor),
      height: Math.round(rect.height * scaleFactor)
    };
  }

  const scaleX = frameWidth / displayBounds.width;
  const scaleY = frameHeight / displayBounds.height;

  // Uniform scale when the frame is a proportional resize of the display.
  if (Math.abs(scaleX - scaleY) <= 0.02) {
    const scale = (scaleX + scaleY) / 2;
    return {
      x: Math.round(relativeX * scale),
      y: Math.round(relativeY * scale),
      width: Math.round(rect.width * scale),
      height: Math.round(rect.height * scale)
    };
  }

  // Aspect mismatch (common on Wayland when the portal returns a cropped buffer):
  // treat as top-left-aligned, map with width scale — do not squash Y by frameHeight.
  const scale = Math.abs(frameWidth - expectedW) <= 2 ? scaleFactor : scaleX;
  return {
    x: Math.round(relativeX * scale),
    y: Math.round(relativeY * scale),
    width: Math.round(rect.width * scale),
    height: Math.round(rect.height * scale)
  };
}

function clampCrop(rect: ScreenRect, frameWidth: number, frameHeight: number): ScreenRect {
  const x = Math.max(0, Math.min(rect.x, frameWidth - 1));
  const y = Math.max(0, Math.min(rect.y, frameHeight - 1));
  const width = Math.max(1, Math.min(rect.width, frameWidth - x));
  const height = Math.max(1, Math.min(rect.height, frameHeight - y));
  return { x, y, width, height };
}

async function cropImageBitmap(
  bitmap: ImageBitmap,
  selection: CaptureRegionSelection
): Promise<Blob> {
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
}

async function cropPngBlob(blob: Blob, selection: CaptureRegionSelection): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  try {
    return await cropImageBitmap(bitmap, selection);
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
  onStep?: (step: RegionCaptureStep) => void,
  options?: { hideApp?: boolean }
): Promise<Blob | null> {
  const hideApp = options?.hideApp ?? true;
  try {
    // macOS: dim the live desktop with the transparent overlay (no frozen
    // screenshot), then grab just the dragged rectangle natively. screencapture
    // -R returns Display P3 pixels straight from the OS, so what the user framed
    // on the real screen is exactly what gets captured.
    if (window.api?.platform === 'darwin') {
      if (hideApp) {
        await hideMainWindow();
        await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
      }

      onStep?.('region');
      const selection = (await window.screenRecorder?.screenshot.selectRegion()) ?? null;
      if (!selection) return null;

      onStep?.('processing');
      // Let the overlay window finish tearing down so it is not in the grab.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
      const buffer = await window.screenRecorder!.screenshot.captureRegion(selection.rect);
      return new Blob([buffer], { type: 'image/png' });
    }

    if (usesOsPicker) {
      // Wayland: GNOME's own picker UI (screen / window / selection) handles
      // the pick-and-capture in one step and hands back the final pixels — no
      // live overlay, no cropping. Hide here too so the compositor starts
      // removing us during the IPC round-trip; main waits an extra settle
      // before calling the portal (GNOME freezes the backdrop immediately).
      onStep?.('picker');
      // The main-process handler hides again with a longer settle; this early
      // hide just lets the compositor start removing us during the IPC trip.
      if (hideApp) await hideMainWindow();
      const buffer = await window.screenRecorder!.screenshot.capturePortal({ hideApp });
      if (!buffer) return null;
      return new Blob([buffer], { type: 'image/png' });
    }

    // Windows/X11 (macOS and Wayland handled above): both platforms give apps
    // global screen coordinates and a fullscreen always-on-top window, so the
    // overlay dims the *live* desktop (no frozen screenshot). After the drag,
    // capture the matched display while the app + overlay are still gone, then
    // crop. Capturing before the finally re-shows the app keeps CraftBox out of
    // the grab.
    if (hideApp) {
      await hideMainWindow();
      await new Promise<void>((resolve) => window.setTimeout(resolve, 150));
    }

    onStep?.('region');
    const selection = (await window.screenRecorder?.screenshot.selectRegion()) ?? null;
    if (!selection) return null;

    const source = findScreenSourceForRegion(sources, selection);
    if (!source) return null;

    onStep?.('processing');
    // Let the overlay window finish tearing down so it is not in the grab.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 80));
    const fullBlob = await captureFromSource(source, { hideApp: false });
    return await cropPngBlob(fullBlob, selection);
  } finally {
    await showApp({ focus: true });
  }
}

export function screenshotFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `screenshot-${stamp}.png`;
}

/** Re-encodes an imported (pasted / opened) image as PNG — the copy/save paths assume PNG bytes. */
export async function toPngBlob(blob: Blob): Promise<Blob> {
  if (blob.type === 'image/png') return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to decode image.');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvasToPngBlob(canvas);
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read captured image'));
    reader.readAsDataURL(blob);
  });
}
