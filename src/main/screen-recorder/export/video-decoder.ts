import { Transform, type TransformCallback } from 'stream';
import ffmpeg, { type FfmpegCommand } from 'fluent-ffmpeg';
import type { ClipSpeed, CropRect, TimeRange } from '@screen-recorder/types/timeline';
import './ffmpeg-config';

export interface DecodedFrame {
  index: number;
  buffer: Buffer;
}

/** Chunks a raw RGBA byte stream into fixed-size per-frame buffers. */
class FrameSplitter extends Transform {
  private leftover: Buffer = Buffer.alloc(0);
  private frameIndex: number;

  constructor(
    private readonly frameSize: number,
    startFrameIndex = 0
  ) {
    super({ readableObjectMode: true, readableHighWaterMark: 8 });
    this.frameIndex = startFrameIndex;
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
 * bounds and rounded to even numbers (several encoders/pix_fmts require
 * even width/height).
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

export interface DecodeFramesOptions {
  sourcePath: string;
  trimRange: TimeRange;
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
  command: FfmpegCommand;
}

/**
 * Decodes one segment of the source video into a stream of RGBA frames,
 * optionally cropped, then pre-scaled and letterboxed to exactly
 * `width x height` so the compositor can treat the inner content rect as an
 * opaque, fixed-size rectangle.
 */
export function decodeFrames(opts: DecodeFramesOptions): DecodeFramesResult {
  const { sourcePath, trimRange, width, height, frameRate, cropRect, speed } = opts;
  const startSec = trimRange.startMs / 1000;
  const durationSec = (trimRange.endMs - trimRange.startMs) / 1000;

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

  const command = ffmpeg(sourcePath)
    .seekInput(startSec)
    // `-t` here must be an *input* option: `.duration()` sets it on the
    // output, which is measured on post-filter timestamps -- once `setpts`
    // rescales those, an output-side `-t` would bound the wrong timeline
    // (reading too much source for speed>1, truncating for speed<1).
    .inputOptions(['-t', String(durationSec)])
    .videoFilters(filters.join(','))
    .outputFormat('rawvideo')
    .outputOptions(['-pix_fmt', 'rgba']);

  const stdout = command.pipe() as unknown as NodeJS.ReadableStream;
  const splitter = new FrameSplitter(width * height * 4);
  stdout.pipe(splitter);

  return { frames: splitter as unknown as AsyncIterable<DecodedFrame>, command };
}
