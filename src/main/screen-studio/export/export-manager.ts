import { promises as fs } from 'fs';
import { dirname } from 'path';
import type { FfmpegCommand } from 'fluent-ffmpeg';
import type { ExportOptions, ExportProgress } from '@screen-studio/types/export';
import { probeSource } from './video-probe';
import { decodeFrames, resolveCropRect } from './video-decoder';
import { FrameCompositor } from './frame-compositor';
import { createEncoder } from './video-encoder';
import './ffmpeg-config';

async function validate(options: ExportOptions): Promise<void> {
  try {
    await fs.access(options.sourceVideoPath);
  } catch {
    throw new Error(`Recording file not found: ${options.sourceVideoPath}`);
  }
  if (options.segments.length === 0) {
    throw new Error('Nothing to export -- every clip on the timeline was cut.');
  }
  if (options.segments.some((s) => s.range.endMs <= s.range.startMs)) {
    throw new Error('One of the kept segments is empty');
  }
  try {
    await fs.access(dirname(options.outputPath));
  } catch {
    throw new Error(`Output directory is not writable: ${dirname(options.outputPath)}`);
  }
}

function writeFrame(stdin: NodeJS.WritableStream, buffer: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = stdin.write(buffer, (err) => {
      if (err) reject(err);
    });
    if (ok) resolve();
    else stdin.once('drain', resolve);
  });
}

function totalFramesFor(segments: ExportOptions['segments'], frameRate: number): number {
  const totalMs = segments.reduce((sum, s) => sum + (s.range.endMs - s.range.startMs), 0);
  return Math.max(1, Math.round((totalMs / 1000) * frameRate));
}

class ExportManager {
  async export(
    options: ExportOptions,
    onProgress: (progress: ExportProgress) => void
  ): Promise<void> {
    const decoderCommands: FfmpegCommand[] = [];
    let encoderCommand: FfmpegCommand | undefined;

    try {
      await validate(options);
      onProgress({ percent: 0, stage: 'rendering' });

      const sourceMeta = await probeSource(options.sourceVideoPath);
      const totalFrames = totalFramesFor(options.segments, options.frameRate);

      // The compositor/inner-rect are fixed for the whole export, so a single
      // representative aspect ratio is needed up front even though crop is
      // now per-segment -- use the first kept clip's own crop if it has one,
      // else fall back to the full source frame. Each segment's *own* crop
      // is still resolved and applied individually inside the decode loop
      // below; this is only for sizing the shared output canvas.
      const firstCropRect = resolveCropRect(
        options.segments[0]?.crop ?? null,
        sourceMeta.width,
        sourceMeta.height
      );
      const sourceAspect = firstCropRect
        ? firstCropRect.width / firstCropRect.height
        : sourceMeta.width / sourceMeta.height;

      const compositor = await FrameCompositor.create(
        options.resolution.width,
        options.resolution.height,
        sourceAspect,
        options.project
      );
      const innerRect = compositor.getInnerRect();

      const encoder = await createEncoder({
        outputPath: options.outputPath,
        format: options.format,
        codec: options.codec,
        width: options.resolution.width,
        height: options.resolution.height,
        frameRate: options.frameRate,
        quality: options.quality,
        sourceVideoPath: options.sourceVideoPath,
        segments: options.segments.map((s) => s.range),
        hasAudio: sourceMeta.hasAudio
      });
      encoderCommand = encoder.command;

      let fatalError: Error | null = null;

      let lastEncodingPercent = -1;
      encoderCommand.on('progress', (p) => {
        if (typeof p.frames !== 'number') return;
        const percent = 50 + Math.min(50, Math.round((p.frames / totalFrames) * 50));
        if (percent !== lastEncodingPercent) {
          lastEncodingPercent = percent;
          onProgress({ percent, stage: 'encoding' });
        }
      });

      const encodingDone = new Promise<void>((resolve, reject) => {
        encoderCommand?.on('end', () => resolve());
        encoderCommand?.on('error', (err) =>
          reject(err instanceof Error ? err : new Error(String(err)))
        );
      });

      encoderCommand.run();

      let frameIndex = 0;
      let lastRenderPercent = -1;
      const msPerFrame = 1000 / options.frameRate;

      // Decode each kept segment in order, writing every composited frame
      // into the *same* encoder stdin -- this is what makes "cut out the
      // middle" / "reorder clips" actually work: the encoder just sees one
      // continuous stream of frames regardless of how many source ranges
      // they came from.
      for (const segment of options.segments) {
        const segmentCropRect = resolveCropRect(segment.crop, sourceMeta.width, sourceMeta.height);
        const { frames, command: decoder } = decodeFrames({
          sourcePath: options.sourceVideoPath,
          trimRange: segment.range,
          width: innerRect.width,
          height: innerRect.height,
          frameRate: options.frameRate,
          cropRect: segmentCropRect,
          startFrameIndex: frameIndex
        });
        decoderCommands.push(decoder);
        decoder.on('error', (err) => {
          fatalError = err instanceof Error ? err : new Error(String(err));
        });

        for await (const frame of frames) {
          if (fatalError) throw fatalError;
          const atMs = frame.index * msPerFrame;
          const composited = compositor.composite(options.project, atMs, frame.buffer);
          await writeFrame(encoder.stdin, composited);

          frameIndex++;
          const percent = Math.min(50, Math.round((frameIndex / totalFrames) * 50));
          if (percent !== lastRenderPercent) {
            lastRenderPercent = percent;
            onProgress({ percent, stage: 'rendering' });
          }
        }
        if (fatalError) throw fatalError;
      }
      encoder.stdin.end();

      await encodingDone;
      onProgress({ percent: 100, stage: 'done' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress({ percent: 0, stage: 'error', error: message });
      decoderCommands.forEach((cmd) => cmd.kill('SIGKILL'));
      encoderCommand?.kill('SIGKILL');
      throw err instanceof Error ? err : new Error(message);
    }
  }
}

export const exportManager = new ExportManager();
