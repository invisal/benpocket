import { fixWebmDuration } from '@fix-webm-duration/fix';
import type {
  AudioInputOptions,
  CaptureSource,
  WebcamOptions
} from '@screen-recorder/types/recording';
import type { CaptureRegionSelection } from '@shared/capture-region';

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
  /**
   * A stream already opened via the native OS picker (getDisplayMedia) --
   * see recording-store.ts's `nativePickerStream`. When present, this is
   * used as-is instead of opening a fresh desktopCapturer/chromeMediaSourceId
   * stream, since a native-picker pick has no id to re-request by. System
   * audio (which normally piggybacks on that same desktop getUserMedia
   * call) isn't available this way -- this stream is video-only.
   */
  existingVideoStream?: MediaStream;
  /**
   * Drag-selected sub-rectangle of `source` ("Area" mode, set via the focus
   * toolbar) -- see cropToRegion() for why this needs a canvas relay rather
   * than a getUserMedia constraint.
   */
  cropRegion?: CaptureRegionSelection;
  /**
   * When `enabled`, a second camera stream is opened and recorded in its own
   * parallel `MediaRecorder` (see `startWebcamRecorder`) -- a fully separate
   * file rather than baked into `stream` above, so position/size/shape stay
   * editable after the fact (see `types/recording.ts`'s `WebcamOptions` doc).
   */
  webcam?: WebcamOptions;
}

export interface StopResult {
  /** The desktop (+ mixed audio) recording. */
  blob: Blob;
  /** The parallel webcam recording, if `CaptureRequest.webcam` was enabled. */
  webcamBlob: Blob | null;
  /** `Date.now()` when the webcam `MediaRecorder` actually started -- see `CaptureHandle.startedAt` for why this matters, and `webcamOffsetMs` in useRecordingController.ts for how callers use the gap between the two. */
  webcamStartedAt: number | null;
}

export interface CaptureHandle {
  /** The combined video (+ mixed audio) stream feeding the recorder. */
  stream: MediaStream;
  /** `Date.now()` at the exact moment the recorder started -- the true t=0 of the output file's timeline, for anything (cursor tracking) that needs to line up samples against it. */
  startedAt: number;
  /** Stops all tracks and both recorders, resolving with the final recording(s). */
  stop: () => Promise<StopResult>;
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
 * only works reliably on Windows/Linux -- see AudioSourceToggle.tsx's macOS
 * caveat.
 *
 * Uses the legacy `chromeMediaSource: 'desktop'` + `chromeMediaSourceId`
 * constraint rather than the standard `getDisplayMedia()` API -- the latter
 * is the only capture path Chromium honors a cursor-hiding constraint on
 * (still-open Chromium bug 1007177 / electron#7584 confirm the legacy path
 * here never has), but routing through it (main-process-resolved, no OS
 * picker dialog) measurably raised CPU/thermal load over a multi-minute
 * recording -- not worth trading for hiding the native pointer. So the
 * native OS cursor stays baked into the captured video pixels, on top of
 * (and separate from) the app's own stylized cursor overlay drawn in the
 * editor/export from `cursor-tracker.ts`'s samples.
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

async function getCameraStream(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : true
  });
}

interface WebcamRecorder {
  startedAt: number;
  stream: MediaStream;
  stop: () => Promise<Blob>;
}

/**
 * Records the camera to its own file via a second `MediaRecorder`, entirely
 * independent of the desktop recorder started alongside it in `startCapture`
 * -- see `CaptureRequest.webcam`'s doc for why this is a parallel file
 * rather than composited into the same stream.
 */
function startWebcamRecorder(stream: MediaStream): WebcamRecorder {
  const recorder = new MediaRecorder(stream, {
    mimeType: pickSupportedMimeType(),
    videoBitsPerSecond: 2_500_000
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
    startedAt,
    stream,
    stop: async (): Promise<Blob> => {
      if (recorder.state !== 'inactive') recorder.stop();
      const rawBlob = await recorderStopped;
      const durationMs = Date.now() - startedAt;
      stream.getTracks().forEach((track) => track.stop());
      try {
        return await fixWebmDuration(rawBlob, durationMs);
      } catch (err) {
        console.error(
          '[capture-engine] failed to patch webcam webm duration, using raw blob:',
          err
        );
        return rawBlob;
      }
    }
  };
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

interface CroppedRelay {
  /** The canvas's own captureStream() -- the *actual* recorded video, not the full desktop. */
  stream: MediaStream;
  stop: () => void;
}

/**
 * Crops a live desktop stream down to a screen-space rectangle by relaying
 * frames through an offscreen canvas. Electron's desktop-capture
 * constraints only support `maxWidth`/`maxHeight` (see getDesktopStream) --
 * there's no live (x,y,w,h) crop in the `chromeMediaSource: 'desktop'`
 * constraint API, and Chromium's CropTarget API only works on tab capture,
 * not desktopCapturer sources. So this is drawn frame-by-frame instead: the
 * output file this feeds MediaRecorder is genuinely just the selected
 * region, not the full screen with a crop applied afterward.
 */
function cropToRegion(sourceStream: MediaStream, region: CaptureRegionSelection): CroppedRelay {
  const settings = sourceStream.getVideoTracks()[0]?.getSettings();
  const trackWidth = settings?.width ?? region.displayBounds.width;
  const trackHeight = settings?.height ?? region.displayBounds.height;

  // `region` was measured in the display's own screen-coordinate space (see
  // region-select.ts), but the delivered track can come back at a different
  // pixel resolution (Retina scaling, the maxWidth/maxHeight constraint,
  // etc.) -- deriving the scale from the *actual* frame size rather than
  // trusting region.scaleFactor keeps this correct either way.
  const scaleX = trackWidth / region.displayBounds.width;
  const scaleY = trackHeight / region.displayBounds.height;
  const crop = {
    x: Math.round((region.rect.x - region.displayBounds.x) * scaleX),
    y: Math.round((region.rect.y - region.displayBounds.y) * scaleY),
    width: Math.max(2, Math.round(region.rect.width * scaleX)),
    height: Math.max(2, Math.round(region.rect.height * scaleY))
  };

  const video = document.createElement('video');
  video.muted = true;
  video.srcObject = sourceStream;
  void video.play();

  const canvas = document.createElement('canvas');
  canvas.width = crop.width;
  canvas.height = crop.height;
  const ctx = canvas.getContext('2d', { alpha: false });

  let rafId = 0;
  let loggedDrawError = false;
  const draw = (): void => {
    if (ctx && video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      // `crop` above is a best guess from getSettings(), taken before any
      // frame actually decoded -- Chromium doesn't always deliver exactly
      // what maxWidth/maxHeight asked for, and drawImage *throws* if the
      // source rect extends even 1px past the video's real decoded bounds.
      // Clamping against those actual bounds every frame (rather than
      // trusting the upfront estimate) is what keeps a few pixels of drift
      // from raising here.
      const sx = Math.max(0, Math.min(crop.x, video.videoWidth - 2));
      const sy = Math.max(0, Math.min(crop.y, video.videoHeight - 2));
      const sw = Math.min(crop.width, video.videoWidth - sx);
      const sh = Math.min(crop.height, video.videoHeight - sy);
      try {
        ctx.drawImage(video, sx, sy, sw, sh, 0, 0, crop.width, crop.height);
      } catch (err) {
        // A single bad frame must never kill the loop -- that's what turned
        // this into an unplayable recording before: drawImage threw here,
        // the requestAnimationFrame(draw) below never ran again, and the
        // canvas (and therefore the whole recorded video track) never
        // received another frame for the rest of the capture.
        if (!loggedDrawError) {
          loggedDrawError = true;
          console.error('[capture-engine] crop draw failed, skipping frame:', err);
        }
      }
    }
    rafId = requestAnimationFrame(draw);
  };
  rafId = requestAnimationFrame(draw);

  const canvasStream = canvas.captureStream(30);

  return {
    stream: canvasStream,
    stop: () => {
      cancelAnimationFrame(rafId);
      video.pause();
      video.srcObject = null;
      canvasStream.getTracks().forEach((track) => track.stop());
    }
  };
}

export async function startCapture(request: CaptureRequest): Promise<CaptureHandle> {
  const desktopStream =
    request.existingVideoStream ??
    (await getDesktopStream(request.source, request.audio.systemAudioEnabled));

  // The crop relay only ever touches *video* -- desktop/mic audio below
  // still comes straight off desktopStream/micStream regardless.
  const croppedRelay = request.cropRegion ? cropToRegion(desktopStream, request.cropRegion) : null;
  const videoStream = croppedRelay?.stream ?? desktopStream;

  const audioTracks: MediaStreamTrack[] = [];
  // A native-picker stream never carries a desktop-audio track (see
  // CaptureRequest.existingVideoStream) -- getAudioTracks() is just empty
  // there, so system audio silently isn't included rather than erroring.
  if (request.audio.systemAudioEnabled) {
    audioTracks.push(...desktopStream.getAudioTracks());
  }

  let micStream: MediaStream | null = null;
  if (request.audio.microphoneEnabled) {
    micStream = await getMicrophoneStream(request.audio.microphoneDeviceId);
    audioTracks.push(...micStream.getAudioTracks());
  }

  // Opened before the desktop recorder starts (below) so it's ready to record
  // the instant that one does -- minimizes the startedAt gap between the two
  // files that useRecordingController.ts later needs to line them back up.
  let cameraStream: MediaStream | null = null;
  if (request.webcam?.enabled) {
    try {
      cameraStream = await getCameraStream(request.webcam.deviceId);
    } catch (err) {
      console.error('[capture-engine] failed to open camera, recording without webcam:', err);
    }
  }

  const finalStream = new MediaStream();
  videoStream.getVideoTracks().forEach((track) => finalStream.addTrack(track));

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
  } = videoStream.getVideoTracks()[0]?.getSettings() ?? {};

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
  const webcamRecorder = cameraStream ? startWebcamRecorder(cameraStream) : null;

  return {
    stream: finalStream,
    startedAt,
    stop: async (): Promise<StopResult> => {
      if (recorder.state !== 'inactive') recorder.stop();
      const [rawBlob, webcamBlob] = await Promise.all([
        recorderStopped,
        webcamRecorder?.stop() ?? Promise.resolve(null)
      ]);
      const durationMs = Date.now() - startedAt;

      // Release every underlying device/track -- otherwise the OS keeps
      // showing the "screen is being recorded" indicator after stopping.
      croppedRelay?.stop();
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
      let blob: Blob;
      try {
        blob = await fixWebmDuration(rawBlob, durationMs);
      } catch (err) {
        console.error('[capture-engine] failed to patch webm duration, using raw blob:', err);
        blob = rawBlob;
      }
      return { blob, webcamBlob, webcamStartedAt: webcamRecorder?.startedAt ?? null };
    }
  };
}

export function fileExtensionForBlob(blob: Blob): string {
  return blob.type.includes('mp4') ? 'mp4' : 'webm';
}
