import type { VideoCodec } from 'mediabunny';
import type { ExportOptions, ExportProgress } from '@screen-recorder/types/export';
import { smoothCursorPath, remapPathToCropSpace } from '@shared/cursor-path';
import { computeAutoZoomFocalPath } from '@shared/zoom-resolve';
import { evaluateSceneAtMs } from './rendering/timeline-evaluator';
import { PixiSceneRenderer } from './rendering/pixi-scene-renderer';
import { resolveCropRect, centerSquareCrop } from './rendering/crop';
import { StreamingVideoDecoder } from './streaming-decoder';
import {
  codecFallbackOrder,
  createVideoEncoder,
  getEncoderPreferences,
  resolveCodecCandidate
} from './video-encoder';
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

  if (options.crop) return false;
  const [segment] = options.segments;
  if (segment.speed !== 1) return false;
  if (Math.abs(segment.range.startMs) > SOURCE_COPY_EPSILON_MS) return false;
  if (Math.abs(segment.range.endMs - sourceInfo.durationMs) > SOURCE_COPY_EPSILON_MS) return false;

  const { project } = options;
  if (project.zoomKeyframes.length > 0) return false;
  if (project.annotations.length > 0) return false;
  if (project.blurMasks.length > 0) return false;
  // Inert while `enabled` is off -- evaluateSceneAtMs already ignores these
  // stored values in that case, so they shouldn't block the fast path
  // either (see timeline-evaluator.ts's `evaluateSceneAtMs`).
  if (project.background.enabled) {
    if (project.background.shadow > 0) return false;
    if (project.background.blur > 0) return false;
    if (project.background.cornerRadius > 0) return false;
    if (project.background.padding > 0) return false;
  }
  if (project.motionBlur) return false;
  if (project.cursor.visible && !segment.cursorHidden && project.cursorPath.length > 0) {
    return false;
  }
  if (project.captions.enabled && project.captions.segments.length > 0) return false;
  // A verbatim byte copy can't have the click-sound overlay mixed in --
  // AudioProcessor.process() (which does that mixing) never runs on this
  // path. `options.includeAudio` (checked above) already guarantees there's
  // an audio track for it to mix into.
  if (project.cursor.clickSoundEnabled && project.clickPath.length > 0) return false;

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
  onProgress: (progress: ExportProgress) => void,
  wasmUrl: string,
  signal?: AbortSignal
): Promise<VideoExportResult> {
  const { options, sourceFile, webcamFile } = request;
  let lastError: Error | null = null;

  for (const codec of codecFallbackOrder(options.codec)) {
    const { muxerCodec } = resolveCodecCandidate(options.format, codec);
    for (const hardwareAcceleration of getEncoderPreferences(muxerCodec)) {
      try {
        // A fresh OffscreenCanvas per attempt, not one shared across retries --
        // PixiSceneRenderer.create() (via autoDetectRenderer) acquires a
        // WebGL/WebGPU rendering context on whatever canvas it's given, and a
        // canvas can only ever hand out one context for its lifetime (the
        // platform has no supported way to release/reacquire one). The first
        // attempt already creates a real renderer (and so a real context)
        // *before* createVideoEncoder's hardware-support check even runs, so a
        // failed first attempt still leaves the canvas's context claimed;
        // reusing it for the retry silently hung forever (no error, no
        // timeout) instead of failing fast -- confirmed as the cause of
        // "hangs at 0%" after a 'prefer-hardware attempt failed' warning.
        const canvas = new OffscreenCanvas(options.resolution.width, options.resolution.height);
        return await runOnce(
          codec === options.codec ? options : { ...options, codec },
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
        console.warn(`[export] ${codec}/${hardwareAcceleration} attempt failed:`, lastError);
      }
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

    const cropRect = resolveCropRect(options.crop, sourceInfo.width, sourceInfo.height);
    const sourceAspect = cropRect
      ? cropRect.width / cropRect.height
      : sourceInfo.width / sourceInfo.height;

    // `cursorPath`/`clickPath` are captured in full-source-frame-normalized
    // space (see remapPathToCropSpace's own doc) but every consumer below
    // positions things as a fraction of the (possibly cropped) `innerRect`
    // -- remapping here, once, keeps smoothing/simulation and rendering in
    // the same space instead of each frame's `resolveCursor` silently
    // misplacing the cursor/ripple whenever a crop is active.
    const croppedCursorPath = remapPathToCropSpace(options.project.cursorPath, options.crop);
    const croppedClickPath = remapPathToCropSpace(options.project.clickPath, options.crop);

    const smoothedCursorPath = smoothCursorPath(
      croppedCursorPath,
      options.project.cursor.smoothing
    );
    // One deadzone-camera-simulated path per 'auto-cursor' keyframe -- see
    // computeAutoZoomFocalPath's doc for why this can't just reuse
    // smoothedCursorPath above.
    const autoZoomFocalPaths = new Map(
      options.project.zoomKeyframes
        .filter((kf) => kf.position === 'auto-cursor')
        .map((kf) => [kf.id, computeAutoZoomFocalPath(croppedCursorPath, kf)])
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
        hasWebcam: options.project.webcam.enabled && Boolean(webcamFile),
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
          return {
            range: { startMs, endMs },
            speed: segment.speed,
            cursorHidden: false,
            webcamHidden: false,
            audioMuted: false,
            audioVolume: 1
          };
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

          const scene = evaluateSceneAtMs(
            options.project,
            sourceTimestampMs,
            options.resolution.width,
            options.resolution.height,
            sourceAspect,
            smoothedCursorPath,
            croppedClickPath,
            autoZoomFocalPaths,
            segment.cursorHidden,
            segment.webcamHidden
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
