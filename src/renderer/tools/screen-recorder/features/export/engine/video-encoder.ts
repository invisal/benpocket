import type { VideoCodec } from 'mediabunny';
import type { ExportCodec, ExportFormat } from '@screen-recorder/types/export';

const ENCODER_STALL_TIMEOUT_MS = 15_000;
const ENCODER_FLUSH_TIMEOUT_MS = 20_000;
/** Smaller queue cap for software encoding so memory doesn't balloon (ported from the reference's Windows-software-fallback note). */
const MAX_ENCODE_QUEUE_HARDWARE = 120;
const MAX_ENCODE_QUEUE_SOFTWARE = 32;

interface CodecCandidate {
  /** WebCodecs codec string passed to `VideoEncoder.configure()`. */
  webCodecsCodec: string;
  /** mediabunny's generic codec tag for `EncodedVideoPacketSource`. */
  muxerCodec: VideoCodec;
  hvc1Tag: boolean;
}

/** WebM cannot legally hold H.264/H.265/AV1 in this app's encoder choice -- always forces VP9, matching the previous ffmpeg pipeline's rule. */
function resolveCodecCandidate(format: ExportFormat, codec: ExportCodec): CodecCandidate {
  if (format === 'webm') {
    return { webCodecsCodec: 'vp09.00.10.08', muxerCodec: 'vp9', hvc1Tag: false };
  }
  switch (codec) {
    case 'h264':
      return { webCodecsCodec: 'avc1.640033', muxerCodec: 'avc', hvc1Tag: false };
    case 'h265':
      return { webCodecsCodec: 'hvc1.1.6.L93.B0', muxerCodec: 'hevc', hvc1Tag: true };
    case 'av1':
      return { webCodecsCodec: 'av01.0.04M.08', muxerCodec: 'av1', hvc1Tag: false };
  }
}

/**
 * Bits-per-pixel tiers for `quality` (0-100) -> target bitrate. WebCodecs'
 * `VideoEncoder` is bitrate-controlled (no CRF-equivalent constant-quality
 * mode exposed), same constraint the previous pipeline's hardware encoders
 * (VideoToolbox/NVENC/QSV/AMF) had.
 */
function qualityToBitsPerPixel(quality: number): number {
  if (quality <= 25) return 0.06;
  if (quality <= 60) return 0.1;
  if (quality <= 90) return 0.14;
  return 0.2;
}

function computeBitrate(width: number, height: number, frameRate: number, quality: number): number {
  return Math.round(width * height * frameRate * qualityToBitsPerPixel(quality));
}

export interface CreateVideoEncoderOptions {
  format: ExportFormat;
  codec: ExportCodec;
  width: number;
  height: number;
  frameRate: number;
  quality: number;
  onChunk: (chunk: EncodedVideoChunk, meta: EncodedVideoChunkMetadata | undefined) => void;
  onFatalError: (error: Error) => void;
}

export interface VideoEncoderSession {
  encoder: VideoEncoder;
  muxerCodec: VideoCodec;
  maxEncodeQueue: number;
  hardwareAcceleration: HardwareAcceleration;
  /** Backpressure wait -- resolves once the encoder's internal queue has room, or throws if it's stalled. */
  waitForCapacity(): Promise<void>;
  flush(): Promise<void>;
  close(): void;
}

/**
 * WebCodecs `VideoEncoder` setup, hardware-then-software retry, and
 * backpressure -- the WebCodecs equivalent of the previous pipeline's
 * ffmpeg-subprocess `resolveVideoEncoder()` hardware-encoder detection, and
 * simpler/more reliable (native browser API, no subprocess functional
 * probing needed: `VideoEncoder.isConfigSupported()` answers the question
 * directly).
 */
export async function createVideoEncoder(
  opts: CreateVideoEncoderOptions,
  hardwareAcceleration: HardwareAcceleration
): Promise<VideoEncoderSession> {
  const candidate = resolveCodecCandidate(opts.format, opts.codec);
  const bitrate = computeBitrate(opts.width, opts.height, opts.frameRate, opts.quality);

  const encoderConfig: VideoEncoderConfig = {
    codec: candidate.webCodecsCodec,
    width: opts.width,
    height: opts.height,
    bitrate,
    framerate: opts.frameRate,
    latencyMode: 'quality',
    bitrateMode: 'variable',
    hardwareAcceleration
  };

  const support = await VideoEncoder.isConfigSupported(encoderConfig);
  if (!support.supported) {
    throw new Error(
      hardwareAcceleration === 'prefer-hardware'
        ? 'Hardware video encoding is not supported on this system.'
        : 'Software video encoding is not supported on this system.'
    );
  }

  let lastOutputAt = Date.now();
  let encodeQueue = 0;

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      lastOutputAt = Date.now();
      encodeQueue = Math.max(0, encodeQueue - 1);
      opts.onChunk(chunk, meta);
    },
    error: (error) => {
      opts.onFatalError(
        error instanceof Error ? error : new Error(`Video encoder error: ${String(error)}`)
      );
    }
  });
  encoder.configure(encoderConfig);

  const maxEncodeQueue =
    hardwareAcceleration === 'prefer-software'
      ? MAX_ENCODE_QUEUE_SOFTWARE
      : MAX_ENCODE_QUEUE_HARDWARE;

  return {
    encoder,
    muxerCodec: candidate.muxerCodec,
    maxEncodeQueue,
    hardwareAcceleration,
    async waitForCapacity() {
      while (encoder.encodeQueueSize >= maxEncodeQueue) {
        if (Date.now() - lastOutputAt > ENCODER_STALL_TIMEOUT_MS) {
          throw new Error(
            hardwareAcceleration === 'prefer-hardware'
              ? 'The hardware video encoder stopped responding. Retrying with a safer encoder.'
              : 'The video encoder stopped responding during export.'
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      encodeQueue++;
    },
    async flush() {
      if (encoder.state !== 'configured') return;
      await withTimeout(
        encoder.flush(),
        ENCODER_FLUSH_TIMEOUT_MS,
        hardwareAcceleration === 'prefer-hardware'
          ? 'The hardware video encoder stopped responding while finalizing the export.'
          : 'The video encoder stopped responding while finalizing the export.'
      );
    },
    close() {
      try {
        if (encoder.state === 'configured') encoder.close();
      } catch {
        /* ignore */
      }
    }
  };
}

/** Try hardware first then software (reversed on Windows, where hardware encoders have proven less reliable -- ported from the reference implementation's own finding). */
export function getEncoderPreferences(): HardwareAcceleration[] {
  if (typeof navigator !== 'undefined' && /\bWindows\b/i.test(navigator.userAgent)) {
    return ['prefer-software', 'prefer-hardware'];
  }
  return ['prefer-hardware', 'prefer-software'];
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
