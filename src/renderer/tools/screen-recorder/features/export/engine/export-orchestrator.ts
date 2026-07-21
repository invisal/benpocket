import type { VideoCodec } from 'mediabunny';
import type { ExportOptions, ExportProgress } from '@screen-recorder/types/export';
import { smoothCursorPath } from '@shared/cursor-path';
import { evaluateSceneAtMs } from './rendering/timeline-evaluator';
import { PixiSceneRenderer } from './rendering/pixi-scene-renderer';
import { resolveCropRect, centerSquareCrop } from './rendering/crop';
import { StreamingVideoDecoder } from './streaming-decoder';
import { createVideoEncoder, getEncoderPreferences } from './video-encoder';
import { WebcamFrameQueue } from './webcam-frame-queue';
import { EXPORT_CANCELLED_MESSAGE, isExportCancelled } from './cancel';

export interface VideoExportRequest {
  options: ExportOptions;
  sourceFile: File;
  webcamFile: File | null;
}

export interface VideoExportResult {
  muxerCodec: VideoCodec;
  chunks: { chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }[];
  sourceHasAudio: boolean;
  sourceDurationSec: number;
}

const SOURCE_COPY_EPSILON_MS = 0.1;

/**
 * The single biggest win available for the common "export with no changes"
 * case -- skip decode/render/encode/mux entirely and hand back the original
 * file's bytes untouched. Ported from the reference implementation.
 */
export function isSourceCopyEligible(
  options: ExportOptions,
  sourceInfo: { width: number; height: number; durationMs: number }
): boolean {
  if (options.format === 'gif') return false;
  if (!options.includeAudio) return false;
  if (
    options.resolution.width !== sourceInfo.width ||
    options.resolution.height !== sourceInfo.height
  ) {
    return false;
  }
  if (options.project.webcam.enabled && options.project.webcamVideoPath) return false;
  if (options.segments.length !== 1) return false;

  const [segment] = options.segments;
  if (segment.crop) return false;
  if (segment.speed !== 1) return false;
  if (Math.abs(segment.range.startMs) > SOURCE_COPY_EPSILON_MS) return false;
  if (Math.abs(segment.range.endMs - sourceInfo.durationMs) > SOURCE_COPY_EPSILON_MS) return false;

  const { project } = options;
  if (project.zoomKeyframes.length > 0) return false;
  if (project.annotations.length > 0) return false;
  if (project.blurMasks.length > 0) return false;
  if (project.background.shadow > 0) return false;
  if (project.background.blur > 0) return false;
  if (project.background.cornerRadius > 0) return false;
  if (project.background.padding > 0) return false;
  if (project.motionBlur) return false;
  if (project.captions.enabled && project.captions.segments.length > 0) return false;

  return true;
}

/**
 * Runs entirely inside the export Worker (see `export-worker.ts`) -- demux
 * (web-demuxer WASM), decode (WebCodecs `VideoDecoder`), composite (PixiJS on
 * an `OffscreenCanvas`, reusing `rendering/*` unchanged), encode
 * (WebCodecs `VideoEncoder`). No ffmpeg subprocess, no nodeIntegration.
 *
 * Audio deliberately isn't handled here: the pitch-preserving speed-change
 * path needs real DOM (`HTMLMediaElement` playback, `requestAnimationFrame`),
 * which doesn't exist inside a Worker. This returns collected encoded video
 * chunks; the caller (running on the main thread) handles audio and does the
 * final mux.
 */
export async function exportVideoOnly(
  request: VideoExportRequest,
  canvas: OffscreenCanvas,
  onProgress: (progress: ExportProgress) => void,
  wasmUrl: string,
  signal?: AbortSignal
): Promise<VideoExportResult> {
  const { options, sourceFile, webcamFile } = request;
  let lastError: Error | null = null;

  for (const hardwareAcceleration of getEncoderPreferences()) {
    try {
      return await runOnce(
        options,
        sourceFile,
        webcamFile,
        canvas,
        hardwareAcceleration,
        onProgress,
        wasmUrl,
        signal
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (isExportCancelled(lastError)) throw lastError;
      console.warn(`[export] ${hardwareAcceleration} attempt failed:`, lastError);
    }
  }

  throw lastError ?? new Error('Video export failed');
}

async function runOnce(
  options: ExportOptions,
  sourceFile: File,
  webcamFile: File | null,
  canvas: OffscreenCanvas,
  hardwareAcceleration: HardwareAcceleration,
  onProgress: (progress: ExportProgress) => void,
  wasmUrl: string,
  signal?: AbortSignal
): Promise<VideoExportResult> {
  const decoder = new StreamingVideoDecoder(wasmUrl);
  let webcamDecoder: StreamingVideoDecoder | null = null;
  let renderer: PixiSceneRenderer | null = null;
  let fatalError: Error | null = null;

  const onAbort = () => {
    decoder.cancel();
    webcamDecoder?.cancel();
  };
  signal?.addEventListener('abort', onAbort);

  try {
    const sourceInfo = await decoder.loadMetadata(sourceFile);

    const firstCropRect = resolveCropRect(
      options.segments[0]?.crop ?? null,
      sourceInfo.width,
      sourceInfo.height
    );
    const sourceAspect = firstCropRect
      ? firstCropRect.width / firstCropRect.height
      : sourceInfo.width / sourceInfo.height;

    const smoothedCursorPath = smoothCursorPath(
      options.project.cursorPath,
      options.project.cursor.smoothing
    );

    renderer = await PixiSceneRenderer.create(
      canvas,
      options.resolution.width,
      options.resolution.height
    );

    const { totalFrames } = decoder.getExportMetrics(options.frameRate, options.segments);

    const chunks: { chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }[] = [];
    const encoderSession = await createVideoEncoder(
      {
        format: options.format,
        codec: options.codec,
        width: options.resolution.width,
        height: options.resolution.height,
        frameRate: options.frameRate,
        quality: options.quality,
        onChunk: (chunk, meta) => chunks.push({ chunk, meta }),
        onFatalError: (error) => {
          fatalError = error;
          decoder.cancel();
          webcamDecoder?.cancel();
        }
      },
      hardwareAcceleration
    );

    let webcamQueue: WebcamFrameQueue | null = null;
    let webcamDecodePromise: Promise<void> | null = null;
    let webcamCropRect: ReturnType<typeof centerSquareCrop> | undefined;

    if (webcamFile && options.project.webcam.enabled) {
      webcamDecoder = new StreamingVideoDecoder(wasmUrl);
      const webcamInfo = await webcamDecoder.loadMetadata(webcamFile);
      webcamCropRect = centerSquareCrop(webcamInfo.width, webcamInfo.height);

      const offsetMs = options.project.webcamOffsetMs;
      const webcamSegments = options.segments
        .map((segment) => {
          const startMs = Math.min(
            Math.max(segment.range.startMs + offsetMs, 0),
            webcamInfo.duration * 1000
          );
          const endMs = Math.min(
            Math.max(segment.range.endMs + offsetMs, startMs),
            webcamInfo.duration * 1000
          );
          return { range: { startMs, endMs }, crop: null, speed: segment.speed };
        })
        .filter((segment) => segment.range.endMs > segment.range.startMs);

      if (webcamSegments.length > 0) {
        const queue = new WebcamFrameQueue();
        webcamQueue = queue;
        const activeWebcamDecoder = webcamDecoder;
        webcamDecodePromise = activeWebcamDecoder
          .decodeAll(options.frameRate, webcamSegments, async (frame) => {
            queue.push(frame);
          })
          .then(
            () => queue.close(),
            (error: unknown) =>
              queue.fail(error instanceof Error ? error : new Error(String(error)))
          );
      }
    }

    let frameIndex = 0;
    let lastPercent = -1;
    const activeRenderer = renderer;

    await decoder.decodeAll(
      options.frameRate,
      options.segments,
      async (videoFrame, _exportTimestampUs, sourceTimestampMs, segment) => {
        try {
          if (fatalError) throw fatalError;
          if (signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE);

          const cropRect = resolveCropRect(segment.crop, sourceInfo.width, sourceInfo.height);

          const scene = evaluateSceneAtMs(
            options.project,
            sourceTimestampMs,
            options.resolution.width,
            options.resolution.height,
            sourceAspect,
            smoothedCursorPath
          );

          let webcamFrame: VideoFrame | null = null;
          if (webcamQueue) {
            webcamFrame = await webcamQueue.next();
          }

          await activeRenderer.renderFrame(
            scene,
            videoFrame,
            cropRect,
            webcamFrame ?? undefined,
            webcamCropRect
          );
          webcamFrame?.close();

          const timestamp = frameIndex * (1_000_000 / options.frameRate);
          const exportFrame = new VideoFrame(activeRenderer.getCanvas(), {
            timestamp,
            duration: 1_000_000 / options.frameRate
          });

          await encoderSession.waitForCapacity();
          if (encoderSession.encoder.state === 'configured') {
            encoderSession.encoder.encode(exportFrame, { keyFrame: frameIndex % 150 === 0 });
          }
          exportFrame.close();

          frameIndex++;
          const percent = Math.min(100, Math.round((frameIndex / totalFrames) * 100));
          if (percent !== lastPercent) {
            lastPercent = percent;
            onProgress({ percent, stage: 'rendering' });
          }
        } finally {
          videoFrame.close();
        }
      },
      (warning) => console.warn('[export]', warning)
    );

    if (fatalError) throw fatalError;
    if (signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE);

    webcamDecoder?.cancel();
    if (webcamDecodePromise) await webcamDecodePromise.catch(() => undefined);
    webcamQueue?.destroy();

    await encoderSession.flush();
    if (fatalError) throw fatalError;
    encoderSession.close();

    return {
      muxerCodec: encoderSession.muxerCodec,
      chunks,
      sourceHasAudio: sourceInfo.hasAudio,
      sourceDurationSec: sourceInfo.duration
    };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    decoder.destroy();
    webcamDecoder?.destroy();
    renderer?.destroy();
  }
}
