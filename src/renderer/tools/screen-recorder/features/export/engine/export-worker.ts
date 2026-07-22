/// <reference lib="webworker" />
import { DOMAdapter, WebWorkerAdapter } from 'pixi.js';
import type { VideoCodec } from 'mediabunny';
import type { ExportOptions, ExportProgress } from '@screen-recorder/types/export';
import { exportVideoOnly } from './export-orchestrator';
import { exportGif } from './gif-exporter';
import { EXPORT_CANCELLED_MESSAGE } from './cancel';

// PixiJS defaults to `BrowserAdapter`, which assumes `document` exists (used
// e.g. by BlurFilter's shader-precision detection). This module runs inside
// a real Worker, which has no DOM at all. `WebWorkerAdapter` is Pixi's own
// official worker-safe adapter. Must run before any PixiJS rendering code.
DOMAdapter.set(WebWorkerAdapter);

const worker = self as unknown as DedicatedWorkerGlobalScope;

export interface RunExportMessage {
  type: 'run';
  options: ExportOptions;
  sourceBytes: ArrayBuffer;
  sourceFileName: string;
  webcamBytes: ArrayBuffer | null;
  webcamFileName: string | null;
  /**
   * Fully-qualified URL for `web-demuxer.wasm`, resolved by the main thread
   * (see `wasm-path.ts`) -- this worker's own bundled script lives at a
   * different directory depth than the main page, so it can't reliably
   * recompute this itself.
   */
  wasmUrl: string;
}

export interface CancelExportMessage {
  type: 'cancel';
}

export type ExportWorkerInMessage = RunExportMessage | CancelExportMessage;

export interface ProgressOutMessage {
  type: 'progress';
  progress: ExportProgress;
}
export interface VideoResultOutMessage {
  type: 'video-result';
  muxerCodec: VideoCodec;
  chunks: { chunk: EncodedVideoChunk; meta?: EncodedVideoChunkMetadata }[];
  sourceHasAudio: boolean;
  sourceDurationSec: number;
}
export interface GifResultOutMessage {
  type: 'gif-result';
  blob: Blob;
}
export interface ErrorOutMessage {
  type: 'error';
  message: string;
}

export type ExportWorkerOutMessage =
  ProgressOutMessage | VideoResultOutMessage | GifResultOutMessage | ErrorOutMessage;

function post(message: ExportWorkerOutMessage): void {
  worker.postMessage(message);
}

// Only one export ever runs per Worker instance (the coordinator spawns a
// fresh Worker per export), so a single module-level controller is enough --
// a 'cancel' message just aborts whichever run is currently in flight.
let activeAbortController: AbortController | null = null;

worker.onmessage = async (event: MessageEvent<ExportWorkerInMessage>) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    activeAbortController?.abort();
    return;
  }

  const controller = new AbortController();
  activeAbortController = controller;
  try {
    const sourceFile = new File([msg.sourceBytes], msg.sourceFileName);
    const webcamFile = msg.webcamBytes
      ? new File([msg.webcamBytes], msg.webcamFileName ?? 'webcam')
      : null;
    const request = { options: msg.options, sourceFile, webcamFile };
    const canvas = new OffscreenCanvas(msg.options.resolution.width, msg.options.resolution.height);

    const onProgress = (progress: ExportProgress) => post({ type: 'progress', progress });

    if (msg.options.format === 'gif') {
      const blob = await exportGif(request, canvas, onProgress, msg.wasmUrl, controller.signal);
      post({ type: 'gif-result', blob });
      return;
    }

    const result = await exportVideoOnly(
      request,
      canvas,
      onProgress,
      msg.wasmUrl,
      controller.signal
    );
    post({
      type: 'video-result',
      muxerCodec: result.muxerCodec,
      chunks: result.chunks,
      sourceHasAudio: result.sourceHasAudio,
      sourceDurationSec: result.sourceDurationSec
    });
  } catch (err) {
    if (!(err instanceof Error && err.message === EXPORT_CANCELLED_MESSAGE)) {
      console.error('[export-worker]', err);
    }
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  } finally {
    activeAbortController = null;
  }
};
