import GIF from 'gif.js';

import gifWorkerUrl from 'gif.js/dist/gif.worker.js?url';
import type { ExportProgress } from '@screen-recorder/types/export';
import { smoothCursorPath } from '@shared/cursor-path';
import { evaluateSceneAtMs } from './rendering/timeline-evaluator';
import { PixiSceneRenderer } from './rendering/pixi-scene-renderer';
import { resolveCropRect, centerSquareCrop } from './rendering/crop';
import { StreamingVideoDecoder } from './streaming-decoder';
import { WebcamFrameQueue } from './webcam-frame-queue';
import type { VideoExportRequest } from './export-orchestrator';
import { EXPORT_CANCELLED_MESSAGE } from './cancel';

/**
 * GIF export reuses the exact same decode+render loop as MP4/WebM/MOV
 * (`export-orchestrator.ts`'s `exportVideoOnly`), just feeding the rendered
 * canvas to `gif.js` (a browser/Worker-based GIF encoder) each frame instead
 * of a WebCodecs `VideoEncoder`. No ffmpeg, no audio track (GIFs don't have
 * one).
 */
export async function exportGif(
  request: VideoExportRequest,
  canvas: OffscreenCanvas,
  onProgress: (progress: ExportProgress) => void,
  wasmUrl: string,
  signal?: AbortSignal
): Promise<Blob> {
  const { options, sourceFile, webcamFile } = request;
  const decoder = new StreamingVideoDecoder(wasmUrl);
  let webcamDecoder: StreamingVideoDecoder | null = null;
  let renderer: PixiSceneRenderer | null = null;
  let gifInstance: GIF | null = null;

  const onAbort = () => {
    decoder.cancel();
    webcamDecoder?.cancel();
    gifInstance?.abort();
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
    const frameDelay = Math.round(1000 / options.frameRate);

    const cores = navigator.hardwareConcurrency || 4;
    const gif = new GIF({
      workers: Math.max(1, Math.min(8, cores - 1)),
      quality: 10,
      width: options.resolution.width,
      height: options.resolution.height,
      workerScript: gifWorkerUrl,
      repeat: 0,
      background: '#000000',
      dither: 'FloydSteinberg'
    });
    gifInstance = gif;

    // gif.js's `addFrame` only accepts `ImageData`, a 2D/WebGL rendering
    // context, or a DOM element (it feature-detects via `childNodes`) --
    // never a bare `OffscreenCanvas`, which has none of those and throws
    // "Invalid image". The render canvas is WebGL/WebGPU-backed (Pixi), so
    // it can't just get a 2D context of its own; drawing it onto a small
    // snapshot canvas and reading that back as `ImageData` works regardless
    // of the source canvas's own context type.
    const snapshotCanvas = new OffscreenCanvas(options.resolution.width, options.resolution.height);
    const snapshotCtx = snapshotCanvas.getContext('2d', { willReadFrequently: true });
    if (!snapshotCtx) throw new Error('Failed to create 2D context for GIF frame snapshot');

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
          if (webcamQueue) webcamFrame = await webcamQueue.next();

          await activeRenderer.renderFrame(
            scene,
            videoFrame,
            cropRect,
            webcamFrame ?? undefined,
            webcamCropRect
          );
          webcamFrame?.close();

          snapshotCtx.drawImage(activeRenderer.getCanvas(), 0, 0);
          const imageData = snapshotCtx.getImageData(
            0,
            0,
            options.resolution.width,
            options.resolution.height
          );
          gif.addFrame(imageData, { delay: frameDelay });

          frameIndex++;
          const percent = Math.min(90, Math.round((frameIndex / totalFrames) * 90));
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

    webcamDecoder?.cancel();
    if (webcamDecodePromise) await webcamDecodePromise.catch(() => undefined);
    webcamQueue?.destroy();

    if (signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE);

    onProgress({ percent: 90, stage: 'encoding' });
    return await new Promise<Blob>((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error(EXPORT_CANCELLED_MESSAGE));
        return;
      }
      gif.on('finished', (blob: Blob) => resolve(blob));
      gif.on('abort', () => reject(new Error(EXPORT_CANCELLED_MESSAGE)));
      gif.on('progress', (progress: number) => {
        onProgress({ percent: 90 + Math.round(progress * 10), stage: 'encoding' });
      });
      try {
        gif.render();
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  } finally {
    signal?.removeEventListener('abort', onAbort);
    decoder.destroy();
    webcamDecoder?.destroy();
    renderer?.destroy();
  }
}
