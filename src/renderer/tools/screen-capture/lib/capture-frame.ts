const CAPTURE_TIMEOUT_MS = 15_000;
// ponytail: fixed delay for WM minimize animation before grabbing a monitor frame
const MINIMIZE_SETTLE_MS = 400;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function minimizeApp(): Promise<void> {
  await window.screenRecorder?.window.minimize();
}

async function restoreApp(): Promise<void> {
  await window.screenRecorder?.window.restore();
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    })
  ]);
}

function waitForVideoReady(video: HTMLVideoElement, timeoutMs: number): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onReady = (): void => {
      if (video.videoWidth > 0) {
        cleanup();
        resolve();
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for capture frame'));
    }, timeoutMs);

    const cleanup = (): void => {
      clearTimeout(timer);
      video.removeEventListener('loadeddata', onReady);
      video.removeEventListener('playing', onReady);
    };

    video.addEventListener('loadeddata', onReady);
    video.addEventListener('playing', onReady);
  });
}

async function grabPngFromStream(stream: MediaStream): Promise<Blob> {
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
    await withTimeout(video.play(), CAPTURE_TIMEOUT_MS, 'Timed out starting capture');
    await waitForVideoReady(video, CAPTURE_TIMEOUT_MS);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvas.width === 0 || canvas.height === 0) {
      throw new Error('Captured screenshot is empty.');
    }
    ctx.drawImage(video, 0, 0);

    return withTimeout(
      new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to encode screenshot'));
        }, 'image/png');
      }),
      5_000,
      'Timed out encoding screenshot'
    );
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    video.remove();
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

/** Opens the OS capture picker, then grabs one PNG frame from the chosen source. */
export async function captureFromSystemPicker(): Promise<Blob> {
  const stream = await openDisplayMediaStream();
  const hideApp = isMonitorCapture(stream);

  if (hideApp) {
    await minimizeApp();
    await delay(MINIMIZE_SETTLE_MS);
  }

  try {
    return await grabPngFromStream(stream);
  } finally {
    if (hideApp) await restoreApp();
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
