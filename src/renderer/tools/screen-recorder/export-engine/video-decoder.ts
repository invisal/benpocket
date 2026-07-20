import { Transform, execa, type TransformCallback, type ResultPromise } from './node-bridge';
import type { ClipSpeed, CropRect, TimeRange } from '@screen-recorder/types/timeline';
import { FFMPEG_PATH } from './ffmpeg-config';

export interface DecodedFrame {
  index: number;
  buffer: Buffer;
}

/** Chunks a raw RGBA byte stream into fixed-size per-frame buffers. */
class FrameSplitter extends Transform {
  private leftover: Buffer = Buffer.alloc(0);
  private frameIndex = 0;

  constructor(private readonly frameSize: number) {
    super({ readableObjectMode: true, readableHighWaterMark: 8 });
  }

  _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    let data = this.leftover.length > 0 ? Buffer.concat([this.leftover, chunk]) : chunk;
    while (data.length >= this.frameSize) {
      const frame: DecodedFrame = {
        index: this.frameIndex++,
        buffer: Buffer.from(data.subarray(0, this.frameSize))
      };
      this.push(frame);
      data = data.subarray(this.frameSize);
    }
    this.leftover = Buffer.from(data);
    callback();
  }
}

/** Crop rect in the *source's* native pixel coordinates (not normalized). */
export interface PixelCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Converts a normalized (0-1) `TimelineSegment.crop` rect (per-clip, not
 * global) into source pixel coordinates, clamped to the source's actual
 * bounds and rounded to even numbers (several pix_fmts require even
 * width/height).
 */
export function resolveCropRect(
  crop: CropRect | null,
  sourceWidth: number,
  sourceHeight: number
): PixelCropRect | undefined {
  if (!crop) return undefined;

  const toEven = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);

  const x = Math.round(Math.min(Math.max(crop.x, 0), 1) * sourceWidth);
  const y = Math.round(Math.min(Math.max(crop.y, 0), 1) * sourceHeight);
  const width = toEven(Math.min(crop.width, 1) * sourceWidth);
  const height = toEven(Math.min(crop.height, 1) * sourceHeight);

  return {
    x: Math.min(x, sourceWidth - width),
    y: Math.min(y, sourceHeight - height),
    width,
    height
  };
}

/**
 * Largest even-sided square centered in a `width x height` frame -- used to
 * crop a typically-16:9 webcam feed down to the square the PiP shape (see
 * rendering-engine/effects/webcam.ts) is clipped from.
 */
export function centerSquareCrop(width: number, height: number): PixelCropRect {
  const toEven = (n: number): number => Math.max(2, Math.floor(n / 2) * 2);
  const side = toEven(Math.min(width, height));
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    width: side,
    height: side
  };
}

export interface DecodeFramesOptions {
  sourcePath: string;
  trimRange: TimeRange;
  /** Target size decoded frames are scaled/letterboxed to -- see the note on why this stays in ffmpeg below. */
  width: number;
  height: number;
  frameRate: number;
  /** Applied before scale/pad, in source pixel coordinates. */
  cropRect?: PixelCropRect;
  /** Playback rate for this clip; `setpts=PTS/speed` rescales output timing. */
  speed: ClipSpeed;
}

export interface DecodeFramesResult {
  frames: AsyncIterable<DecodedFrame>;
  command: ResultPromise;
}

/**
 * Decodes one segment of the source video into a stream of RGBA frames,
 * scaled/letterboxed to exactly `width x height` (ffmpeg's `swscale`, same
 * as the pre-PixiJS pipeline) -- *not* decoded at native resolution and
 * resized on the GPU. That was tried and measurably regressed export speed:
 * for a source much larger than the output (e.g. a 3456x2234 recording
 * exported at 960x540), native-resolution decode means every frame is a
 * ~30MB buffer that has to cross the ffmpeg stdout pipe, get copied, and
 * `postMessage`-transfer to the render Worker -- versus ~2MB once
 * pre-scaled here. swscale is cheap and shrinks the data *before* any of
 * those further hops, which matters far more than saving that one resize by
 * doing it on the GPU instead. The rendering engine still positions/zooms
 * this pre-scaled frame at `innerRect` on the GPU; only the initial fit-to-
 * canvas resize happens in ffmpeg.
 */
export function decodeFrames(opts: DecodeFramesOptions): DecodeFramesResult {
  const { sourcePath, trimRange, width, height, frameRate, cropRect, speed } = opts;
  const startSec = trimRange.startMs / 1000;
  const durationSec = (trimRange.endMs - trimRange.startMs) / 1000;

  // No in_color_matrix pin on the YUV->RGBA conversion, deliberately:
  // Chromium's MediaRecorder tags its WebM bt709/tv (verified via ffprobe on
  // real recordings), and swscale's default `auto` follows those tags.
  // Forcing a matrix here would break any correctly-tagged source. The
  // untagged direction (RGBA->YUV) is pinned in video-encoder.ts instead.
  const filters: string[] = [];
  if (cropRect) {
    filters.push(`crop=${cropRect.width}:${cropRect.height}:${cropRect.x}:${cropRect.y}`);
  }
  // Must land before `fps=`, which resamples off presentation timestamps.
  if (speed !== 1) {
    filters.push(`setpts=PTS/${speed}`);
  }
  filters.push(
    `fps=${frameRate}`,
    `scale=${width}:${height}:force_original_aspect_ratio=decrease`,
    `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black@0`
  );

  // `-ss`/`-t` must be *input* options (before `-i`): `-t` measured on
  // post-filter timestamps as an output option would bound the wrong
  // timeline once `setpts` rescales those (reading too much source for
  // speed>1, truncating for speed<1).
  const args = [
    '-ss',
    String(startSec),
    '-t',
    String(durationSec),
    '-i',
    sourcePath,
    '-filter:v',
    filters.join(','),
    '-f',
    'rawvideo',
    '-pix_fmt',
    'rgba',
    'pipe:1'
  ];

  const command = execa(FFMPEG_PATH, args, { stdout: 'pipe', stderr: 'pipe', buffer: false });
  const stdout = command.stdout as NodeJS.ReadableStream;
  const splitter = new FrameSplitter(width * height * 4);
  stdout.pipe(splitter);

  return { frames: splitter as unknown as AsyncIterable<DecodedFrame>, command };
}
