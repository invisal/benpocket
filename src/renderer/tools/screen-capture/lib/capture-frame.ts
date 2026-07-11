import type { CaptureSource } from '@screen-recorder/types/recording';

interface DesktopVideoConstraint {
  mandatory: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    maxWidth: number;
    maxHeight: number;
  };
}

// ponytail: macOS compositor may need a beat after hide before the frame is clean.
const HIDE_SETTLE_MS_DARWIN = 300;

function hideSettleMs(): number {
  return window.api?.platform === 'darwin' ? HIDE_SETTLE_MS_DARWIN : 0;
}

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function hideApp(): Promise<void> {
  await window.screenRecorder?.window.hide();
  await delay(hideSettleMs());
}

async function showApp(): Promise<void> {
  await window.screenRecorder?.window.restore();
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

/** Grabs one PNG frame from a desktopCapturer source chosen in the in-app picker. */
export async function captureFromSource(source: CaptureSource): Promise<Blob> {
  const shouldHideApp = source.type === 'screen';

  if (shouldHideApp) {
    await hideApp();
  }

  try {
    const stream = await getDesktopVideoStream(source);
    return await grabPngFromStream(stream);
  } finally {
    if (shouldHideApp) await showApp();
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
