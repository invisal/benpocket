import { fsPromises as fs, dirname, type ResultPromise } from './node-bridge';
import type { ExportOptions, ExportProgress } from '@screen-recorder/types/export';
import type { DecodedFrame } from './video-decoder';
import { probeSource, type SourceMeta } from './video-probe';
import { decodeFrames, resolveCropRect, centerSquareCrop } from './video-decoder';
import { createEncoder } from './video-encoder';
import { RenderWorkerClient } from './render-worker-client';
import { smoothCursorPath } from '@shared/cursor-path';
import { REFERENCE_CANVAS_WIDTH } from '@shared/constants';
import { computeInnerRect } from '../rendering-engine/inner-rect';

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

/**
 * Resolves `true` once written, or `false` if the encoder already finished
 * and closed its stdin -- ffmpeg's `-shortest` (used whenever there's an
 * audio track) stops it as soon as the shorter of the video/audio streams
 * ends, which can land a frame or two before our own frame-count estimate
 * (`totalFramesFor`) expects, since the source's real frame rate is rarely
 * exactly `frameRate` (e.g. a 29.5fps recording resampled to a 30fps
 * export). Writing to that now-closed pipe is an expected, benign race, not
 * a failure -- the caller stops feeding frames once this returns `false`.
 */
function writeFrame(stdin: NodeJS.WritableStream, buffer: Uint8Array): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const ok = stdin.write(buffer, (err) => {
      if (!err) return;
      if ((err as NodeJS.ErrnoException).code === 'EPIPE') {
        resolve(false);
        return;
      }
      reject(err);
    });
    if (ok) resolve(true);
    else stdin.once('drain', () => resolve(true));
  });
}

function totalFramesFor(segments: ExportOptions['segments'], frameRate: number): number {
  const totalMs = segments.reduce((sum, s) => sum + (s.range.endMs - s.range.startMs) / s.speed, 0);
  return Math.max(1, Math.round((totalMs / 1000) * frameRate));
}

/** ffmpeg prints periodic `frame=  123 fps= 45 ...` status lines to stderr even without a dedicated progress flag. */
function parseFrameCount(chunk: string): number | null {
  const match = /frame=\s*(\d+)/.exec(chunk);
  return match ? Number(match[1]) : null;
}

/**
 * Runs entirely on the hidden export window's own thread (see
 * export-worker-window.ts in main, which creates that window). Owns the
 * ffmpeg decode/encode subprocesses directly (this window has Node
 * integration) and hands frames to the nested PixiJS render Worker instead
 * of a CPU compositor -- see the plan's architecture diagram for why
 * everything lives in this one process.
 */
class ExportOrchestrator {
  async export(
    options: ExportOptions,
    onProgress: (progress: ExportProgress) => void
  ): Promise<void> {
    const decoderCommands: ResultPromise[] = [];
    let encoderCommand: ResultPromise | undefined;
    let renderWorker: RenderWorkerClient | undefined;

    try {
      await validate(options);
      onProgress({ percent: 0, stage: 'rendering' });
      console.log('[export] validated, probing source:', options.sourceVideoPath);

      const sourceMeta = await probeSource(options.sourceVideoPath);
      console.log('[export] source probed:', sourceMeta);
      const totalFrames = totalFramesFor(options.segments, options.frameRate);

      const webcamVideoPath = options.project.webcam.enabled
        ? options.project.webcamVideoPath
        : null;
      let webcamMeta: SourceMeta | null = null;
      if (webcamVideoPath) {
        try {
          webcamMeta = await probeSource(webcamVideoPath);
        } catch (err) {
          console.error('[export] failed to probe webcam recording, using placeholder PiP:', err);
        }
      }

      // Same representative-aspect-ratio approach as before: a single shared
      // output canvas is sized once up front from the first kept clip's own
      // crop (or the full source frame), even though crop is resolved
      // per-segment inside the loop below.
      const firstCropRect = resolveCropRect(
        options.segments[0]?.crop ?? null,
        sourceMeta.width,
        sourceMeta.height
      );
      const sourceAspect = firstCropRect
        ? firstCropRect.width / firstCropRect.height
        : sourceMeta.width / sourceMeta.height;
      // ffmpeg scales/letterboxes decoded frames to this size directly (see
      // video-decoder.ts's doc comment for why that stays in ffmpeg rather
      // than being a GPU resize) -- same formula the render worker's scene
      // evaluation uses per frame, computed once here since it's fixed for
      // the whole export.
      const innerRect = computeInnerRect(
        options.resolution.width,
        options.resolution.height,
        sourceAspect,
        options.project.background.padding
      );

      // Smoothing doesn't depend on `atMs`, so it's computed once up front
      // and sent to the render worker rather than recomputed per frame.
      const smoothedCursorPath = smoothCursorPath(
        options.project.cursorPath,
        options.project.cursor.smoothing
      );

      console.log('[export] creating render worker (PixiJS + OffscreenCanvas)...');
      renderWorker = await RenderWorkerClient.create(
        options.resolution.width,
        options.resolution.height
      );
      console.log('[export] render worker ready, loading project...');
      await renderWorker.loadProject(options.project, sourceAspect, smoothedCursorPath);
      console.log('[export] project loaded, creating encoder (resolving hardware encoder)...');

      const encoder = await createEncoder({
        outputPath: options.outputPath,
        format: options.format,
        codec: options.codec,
        width: options.resolution.width,
        height: options.resolution.height,
        frameRate: options.frameRate,
        quality: options.quality,
        sourceVideoPath: options.sourceVideoPath,
        segments: options.segments.map((s) => ({ range: s.range, speed: s.speed })),
        hasAudio: sourceMeta.hasAudio
      });
      encoderCommand = encoder.command;
      encoderCommand.catch((err: unknown) => {
        console.error('[export] encoder command rejected:', err);
      });
      console.log('[export] encoder spawned, starting decode/render/encode loop...');

      let fatalError: Error | null = null;

      let lastEncodingPercent = -1;
      encoderCommand.stderr?.on('data', (chunk: Buffer) => {
        const frames = parseFrameCount(chunk.toString());
        if (frames === null) return;
        const percent = 50 + Math.min(50, Math.round((frames / totalFrames) * 50));
        if (percent !== lastEncodingPercent) {
          lastEncodingPercent = percent;
          onProgress({ percent, stage: 'encoding' });
        }
      });

      const encodingDone = encoderCommand.then(
        () => undefined,
        (err) => {
          throw err instanceof Error ? err : new Error(String(err));
        }
      );

      let frameIndex = 0;
      let lastRenderPercent = -1;
      let encoderClosed = false;
      const msPerFrame = 1000 / options.frameRate;

      for (const segment of options.segments) {
        if (encoderClosed) break;
        const segmentCropRect = resolveCropRect(segment.crop, sourceMeta.width, sourceMeta.height);
        const { frames, command: decoder } = decodeFrames({
          sourcePath: options.sourceVideoPath,
          trimRange: segment.range,
          width: innerRect.width,
          height: innerRect.height,
          frameRate: options.frameRate,
          cropRect: segmentCropRect,
          speed: segment.speed
        });
        decoderCommands.push(decoder);
        decoder.catch((err: unknown) => {
          fatalError = err instanceof Error ? err : new Error(String(err));
        });

        let webcamFrames: AsyncIterator<DecodedFrame> | null = null;
        let webcamFrameSize = 0;
        if (webcamMeta && webcamVideoPath) {
          const offsetMs = options.project.webcamOffsetMs;
          const webcamStart = Math.min(
            Math.max(segment.range.startMs + offsetMs, 0),
            webcamMeta.durationMs
          );
          const webcamEnd = Math.min(
            Math.max(segment.range.endMs + offsetMs, webcamStart),
            webcamMeta.durationMs
          );
          if (webcamEnd > webcamStart) {
            webcamFrameSize = Math.round(
              options.project.webcam.size * (options.resolution.width / REFERENCE_CANVAS_WIDTH)
            );
            const webcamDecode = decodeFrames({
              sourcePath: webcamVideoPath,
              trimRange: { startMs: webcamStart, endMs: webcamEnd },
              width: webcamFrameSize,
              height: webcamFrameSize,
              frameRate: options.frameRate,
              cropRect: centerSquareCrop(webcamMeta.width, webcamMeta.height),
              speed: segment.speed
            });
            decoderCommands.push(webcamDecode.command);
            webcamDecode.command.catch((err: unknown) => {
              console.error(
                '[export] webcam decode failed for this segment, using placeholder:',
                err
              );
            });
            webcamFrames = webcamDecode.frames[Symbol.asyncIterator]();
          }
        }

        let segmentFrameIndex = 0;
        for await (const frame of frames) {
          if (fatalError) throw fatalError;
          if (segmentFrameIndex === 0) {
            console.log(
              `[export] first decoded frame for segment (${innerRect.width}x${innerRect.height})`
            );
          }
          const atMs = segment.range.startMs + segmentFrameIndex * msPerFrame * segment.speed;

          let webcamFrame: { buffer: Buffer; size: number } | undefined;
          if (webcamFrames) {
            try {
              const next = await webcamFrames.next();
              if (!next.done) webcamFrame = { buffer: next.value.buffer, size: webcamFrameSize };
            } catch (err) {
              console.error(
                '[export] webcam frame decode error, using placeholder for this frame:',
                err
              );
            }
          }

          const composited = await renderWorker.renderFrame(
            atMs,
            frame.buffer,
            innerRect.width,
            innerRect.height,
            webcamFrame
          );
          if (segmentFrameIndex === 0) {
            console.log('[export] first frame rendered by PixiJS worker, writing to encoder...');
          }
          const wrote = await writeFrame(encoder.stdin, composited);
          if (!wrote) {
            // Encoder already finished and closed its stdin (see
            // writeFrame's doc comment) -- stop feeding it frames, but this
            // isn't a failure, so don't touch `fatalError`. Both this
            // segment's decoders (main + webcam, if any) are still running
            // with nowhere left to drain their output -- kill them rather
            // than leaving them blocked on a full pipe.
            encoderClosed = true;
            decoderCommands.forEach((cmd) => cmd.kill('SIGKILL'));
            break;
          }
          if (segmentFrameIndex === 0) {
            console.log('[export] first frame written to encoder stdin');
          }

          segmentFrameIndex++;
          frameIndex++;
          const percent = Math.min(50, Math.round((frameIndex / totalFrames) * 50));
          if (percent !== lastRenderPercent) {
            lastRenderPercent = percent;
            onProgress({ percent, stage: 'rendering' });
          }
        }
        if (fatalError) throw fatalError;
        decoder.kill('SIGKILL');
      }
      if (!encoderClosed) encoder.stdin.end();

      await encodingDone;
      onProgress({ percent: 100, stage: 'done' });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      onProgress({ percent: 0, stage: 'error', error: message });
      decoderCommands.forEach((cmd) => cmd.kill('SIGKILL'));
      encoderCommand?.kill('SIGKILL');
      throw err instanceof Error ? err : new Error(message);
    } finally {
      renderWorker?.destroy();
    }
  }
}

export const exportOrchestrator = new ExportOrchestrator();
