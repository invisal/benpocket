import { fixWebmDuration } from '@fix-webm-duration/fix';
import type { AudioInputOptions, CaptureSource } from '@screen-recorder/types/recording';

// Electron's desktop capture constraints (`chromeMediaSource`, `mandatory`)
// predate the standard Constrainable properties and aren't in lib.dom's
// MediaTrackConstraints type. See:
// https://www.electronjs.org/docs/latest/api/desktop-capturer
interface DesktopAudioConstraint {
  mandatory: {
    chromeMediaSource: 'desktop';
  };
}

interface DesktopVideoConstraint {
  mandatory: {
    chromeMediaSource: 'desktop';
    chromeMediaSourceId: string;
    maxWidth?: number;
    maxHeight?: number;
  };
}

export interface CaptureRequest {
  source: CaptureSource;
  audio: AudioInputOptions;
}

export interface CaptureHandle {
  /** The combined video (+ mixed audio) stream feeding the recorder. */
  stream: MediaStream;
  /** `Date.now()` at the exact moment the recorder started -- the true t=0 of the output file's timeline, for anything (cursor tracking) that needs to line up samples against it. */
  startedAt: number;
  /** Stops all tracks and the recorder, resolving with the final recording. */
  stop: () => Promise<Blob>;
}

function pickSupportedMimeType(): string {
  const candidates = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? 'video/webm';
}

/**
 * Chromium's MediaRecorder defaults to a flat 2.5 Mbps when no bitrate is
 * given, regardless of resolution -- a Retina display capture gets the same
 * bandwidth as a 480p webcam, which is why recordings look blurry next to
 * native recorders. Target ~3 bits per pixel per second (~0.1 bpp at the
 * ~30 fps Chromium captures desktops at): 1080p lands on the 8 Mbps floor,
 * 4K ~25 Mbps, 5K Retina hits the 40 Mbps cap. The intermediate WebM is a
 * scratch file that export re-encodes, so err on the high side.
 */
function videoBitsPerSecondFor(width: number, height: number): number {
  return Math.min(Math.max(width * height * 3, 8_000_000), 40_000_000);
}

/**
 * Captures the chosen screen/window as a video track, plus (best-effort)
 * system audio as a loopback audio track. System audio via this mechanism
 * only works reliably on Windows/Linux -- see
 * main/capture/system-audio-capture.ts for the macOS caveat.
 */
async function getDesktopStream(
  source: CaptureSource,
  wantSystemAudio: boolean
): Promise<MediaStream> {
  const scale = window.devicePixelRatio || 1;

  // A 'screen' source fills the full display, so bounding the capture to the
  // display's own resolution is correct. A 'window' source (e.g. the iOS
  // Simulator) is almost always much smaller than the display -- forcing the
  // same full-display maxWidth/maxHeight there makes Chromium hand back a
  // frame padded to that larger size, with the actual window content
  // shrunk into a corner and the rest filled black. Sizing to the window's
  // own bounds when known (or omitting the constraint entirely so Chromium
  // just uses the window's native captured size) avoids the padding.
  const sizeConstraint =
    source.type === 'screen'
      ? { maxWidth: window.screen.width * scale, maxHeight: window.screen.height * scale }
      : source.displayBounds
        ? {
            maxWidth: Math.round(source.displayBounds.width * scale),
            maxHeight: Math.round(source.displayBounds.height * scale)
          }
        : {};

  const constraints: MediaStreamConstraints = {
    audio: wantSystemAudio
      ? ({
          mandatory: { chromeMediaSource: 'desktop' }
        } as unknown as DesktopAudioConstraint as never)
      : false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
        ...sizeConstraint
      }
    } as unknown as DesktopVideoConstraint as never
  };

  return navigator.mediaDevices.getUserMedia(constraints);
}

async function getMicrophoneStream(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true
  });
}

/** Mixes any number of audio tracks down to a single track via Web Audio. */
function mixAudioTracks(tracks: MediaStreamTrack[]): {
  track: MediaStreamTrack;
  context: AudioContext;
} {
  const context = new AudioContext();
  const destination = context.createMediaStreamDestination();
  for (const track of tracks) {
    const source = context.createMediaStreamSource(new MediaStream([track]));
    source.connect(destination);
  }
  return { track: destination.stream.getAudioTracks()[0], context };
}

export async function startCapture(request: CaptureRequest): Promise<CaptureHandle> {
  const desktopStream = await getDesktopStream(request.source, request.audio.systemAudioEnabled);

  const audioTracks: MediaStreamTrack[] = [];
  if (request.audio.systemAudioEnabled) {
    audioTracks.push(...desktopStream.getAudioTracks());
  }

  let micStream: MediaStream | null = null;
  if (request.audio.microphoneEnabled) {
    micStream = await getMicrophoneStream(request.audio.microphoneDeviceId);
    audioTracks.push(...micStream.getAudioTracks());
  }

  const finalStream = new MediaStream();
  desktopStream.getVideoTracks().forEach((track) => finalStream.addTrack(track));

  let mixContext: AudioContext | null = null;
  if (audioTracks.length === 1) {
    finalStream.addTrack(audioTracks[0]);
  } else if (audioTracks.length > 1) {
    const { track, context } = mixAudioTracks(audioTracks);
    mixContext = context;
    finalStream.addTrack(track);
  }

  const scale = window.devicePixelRatio || 1;
  const {
    width = Math.round(window.screen.width * scale),
    height = Math.round(window.screen.height * scale)
  } = desktopStream.getVideoTracks()[0]?.getSettings() ?? {};

  const recorder = new MediaRecorder(finalStream, {
    mimeType: pickSupportedMimeType(),
    videoBitsPerSecond: videoBitsPerSecondFor(width, height)
  });
  const chunks: BlobPart[] = [];

  recorder.ondataavailable = (event): void => {
    if (event.data.size > 0) chunks.push(event.data);
  };

  const recorderStopped = new Promise<Blob>((resolve) => {
    recorder.onstop = (): void => resolve(new Blob(chunks, { type: recorder.mimeType }));
  });

  const startedAt = Date.now();
  recorder.start(250);

  return {
    stream: finalStream,
    startedAt,
    stop: async (): Promise<Blob> => {
      if (recorder.state !== 'inactive') recorder.stop();
      const rawBlob = await recorderStopped;
      const durationMs = Date.now() - startedAt;

      // Release every underlying device/track -- otherwise the OS keeps
      // showing the "screen is being recorded" indicator after stopping.
      desktopStream.getTracks().forEach((track) => track.stop());
      micStream?.getTracks().forEach((track) => track.stop());
      finalStream.getTracks().forEach((track) => track.stop());
      if (mixContext) void mixContext.close();

      // MediaRecorder's webm output has no Duration in its header, so
      // <video>.duration reads as Infinity and Chromium often refuses to
      // paint any frame at all -- the recording plays back as a black,
      // unscrubbable box even though the capture itself is fine. This patches
      // the correct duration into the file so it plays normally. See
      // https://github.com/yusitnikov/fix-webm-duration
      try {
        return await fixWebmDuration(rawBlob, durationMs);
      } catch (err) {
        console.error('[capture-engine] failed to patch webm duration, using raw blob:', err);
        return rawBlob;
      }
    }
  };
}

export function fileExtensionForBlob(blob: Blob): string {
  return blob.type.includes('mp4') ? 'mp4' : 'webm';
}
