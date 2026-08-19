import { WebDemuxer } from 'web-demuxer';
import ExportWorker from './export-worker?worker';
import type {
  ExportWorkerInMessage,
  ExportWorkerOutMessage,
  RunExportMessage
} from './export-worker';
import type { ExportOptions, ExportProgress } from '@screen-recorder/types/export';
import { StreamingVideoDecoder } from './streaming-decoder';
import { VideoMuxer } from './muxer';
import { AudioProcessor, type ClickSoundOptions } from './audio-encoder';
import { isSourceCopyEligible } from './export-orchestrator';
import { resolveWebDemuxerWasmPath } from './wasm-path';
import { EXPORT_CANCELLED_MESSAGE } from './cancel';

export interface RunExportResult {
  actualBytes: number;
  wasEncoded: boolean;
  includedAudio: boolean;
}

/**
 * Runs on the renderer's main thread (called directly from
 * `useExportAction.ts` -- no IPC round trip for orchestration, only for the
 * two raw file-read/file-write primitives). Spawns the export Worker for the
 * actual decode/render/encode work, then -- since the pitch-preserving
 * audio path needs real DOM (`HTMLMediaElement` playback), which a Worker
 * doesn't have -- handles audio processing and final muxing here before
 * writing the result to disk.
 */
export async function runExport(
  options: ExportOptions,
  onProgress: (progress: ExportProgress) => void,
  signal?: AbortSignal
): Promise<RunExportResult> {
  if (signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE);

  const wasmUrl = resolveWebDemuxerWasmPath();
  const sourceBytes = await window.screenRecorder.export.readFileBytes(options.sourceVideoPath);
  const sourceFileName = options.sourceVideoPath.split(/[/\\]/).pop() ?? 'source';
  const sourceFile = new File([sourceBytes], sourceFileName);

  if (options.format !== 'gif') {
    const probeDecoder = new StreamingVideoDecoder(wasmUrl);
    try {
      const sourceInfo = await probeDecoder.loadMetadata(sourceFile);
      const eligible = isSourceCopyEligible(options, {
        width: sourceInfo.width,
        height: sourceInfo.height,
        durationMs: sourceInfo.duration * 1000
      });
      if (eligible) {
        onProgress({ percent: 100, stage: 'encoding' });
        await window.screenRecorder.export.writeFileBytes(options.outputPath, sourceBytes);
        onProgress({ percent: 100, stage: 'done' });
        return {
          actualBytes: sourceBytes.byteLength,
          wasEncoded: false,
          includedAudio: options.includeAudio
        };
      }
    } finally {
      probeDecoder.destroy();
    }
  }

  const webcamPath = options.project.webcam.enabled ? options.project.webcamVideoPath : null;
  let webcamBytes: ArrayBuffer | null = null;
  let webcamFileName: string | null = null;
  if (webcamPath) {
    try {
      webcamBytes = await window.screenRecorder.export.readFileBytes(webcamPath);
      webcamFileName = webcamPath.split(/[/\\]/).pop() ?? 'webcam';
    } catch (err) {
      console.error('[export] failed to read webcam recording, exporting without it:', err);
    }
  }

  const worker = new ExportWorker();
  try {
    const { bytes: outputBytes, includedAudio } = await runWorker(
      worker,
      options,
      sourceFile,
      sourceBytes,
      webcamBytes,
      webcamFileName,
      onProgress,
      wasmUrl,
      signal
    );
    onProgress({ percent: 100, stage: 'encoding' });
    await window.screenRecorder.export.writeFileBytes(options.outputPath, outputBytes);
    onProgress({ percent: 100, stage: 'done' });
    return { actualBytes: outputBytes.byteLength, wasEncoded: true, includedAudio };
  } finally {
    worker.terminate();
  }
}

interface WorkerRunResult {
  bytes: ArrayBuffer;
  /** `false` for a GIF export -- that format never carries audio at all. */
  includedAudio: boolean;
}

function runWorker(
  worker: Worker,
  options: ExportOptions,
  sourceFile: File,
  sourceBytes: ArrayBuffer,
  webcamBytes: ArrayBuffer | null,
  webcamFileName: string | null,
  onProgress: (progress: ExportProgress) => void,
  wasmUrl: string,
  signal?: AbortSignal
): Promise<WorkerRunResult> {
  return new Promise((resolve, reject) => {
    const onAbort = () => worker.postMessage({ type: 'cancel' } satisfies ExportWorkerInMessage);
    signal?.addEventListener('abort', onAbort);
    const cleanup = () => signal?.removeEventListener('abort', onAbort);

    worker.onmessage = (event: MessageEvent<ExportWorkerOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        onProgress(msg.progress);
        return;
      }
      if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message));
        return;
      }
      if (msg.type === 'gif-result') {
        cleanup();
        void msg.blob
          .arrayBuffer()
          .then((bytes) => resolve({ bytes, includedAudio: false }), reject);
        return;
      }
      // video-result: needs audio processing (main-thread only, see module
      // doc comment) and final muxing before it's ready to write out.
      cleanup();
      void finishVideoExport(options, sourceFile, msg, wasmUrl, signal).then(resolve, reject);
    };
    worker.onerror = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || 'export worker crashed'));
    };

    const message: RunExportMessage = {
      type: 'run',
      options,
      // Deliberately *not* transferred: this thread still needs `sourceFile`
      // afterward for audio processing (the pitch-preserving path in
      // particular needs a real playable URL, which needs the bytes to
      // still be here). A structured-clone copy costs one memcpy, far
      // cheaper than a second IPC file read.
      sourceBytes: sourceBytes.slice(0),
      sourceFileName: sourceFile.name,
      webcamBytes,
      webcamFileName,
      wasmUrl
    };
    const transfer: Transferable[] = [];
    if (webcamBytes) transfer.push(webcamBytes);
    worker.postMessage(message satisfies ExportWorkerInMessage, transfer);
  });
}

async function finishVideoExport(
  options: ExportOptions,
  sourceFile: File,
  result: Extract<ExportWorkerOutMessage, { type: 'video-result' }>,
  wasmUrl: string,
  signal?: AbortSignal
): Promise<WorkerRunResult> {
  if (signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE);
  const includeAudio = result.sourceHasAudio && options.includeAudio;

  let audioActuallyProcessed = false;
  const audioMuxerCodec = options.format === 'webm' ? 'opus' : 'aac';
  const muxer = new VideoMuxer(
    {
      format: options.format as Exclude<typeof options.format, 'gif'>,
      frameRate: options.frameRate,
      videoCodec: result.muxerCodec
    },
    includeAudio,
    audioMuxerCodec
  );
  await muxer.initialize();

  for (const { chunk, meta } of result.chunks) {
    await muxer.addVideoChunk(chunk, meta);
  }

  if (includeAudio) {
    // Short-lived, used only to pick a codec -- destroyed before real audio
    // processing starts so AudioProcessor.process() (which may itself open
    // demuxers) never has two WebDemuxer-spawned WASM Workers alive at once.
    const probeDemuxer = new WebDemuxer({ wasmFilePath: wasmUrl });
    let exportCodec: Awaited<ReturnType<typeof AudioProcessor.selectSupportedExportCodecForSource>>;
    try {
      await probeDemuxer.load(sourceFile);
      exportCodec = await AudioProcessor.selectSupportedExportCodecForSource(
        probeDemuxer,
        audioMuxerCodec
      );
    } finally {
      probeDemuxer.destroy();
    }

    if (exportCodec) {
      const sourceObjectUrl = URL.createObjectURL(sourceFile);
      const audioProcessor = new AudioProcessor();
      const onAbort = () => audioProcessor.cancel();
      signal?.addEventListener('abort', onAbort);
      // Only bothers building this when there's actually a click to mix --
      // `AudioProcessor` treats an all-zero-clicks options object the same
      // as `null` anyway, but skipping construction keeps the common
      // no-clicks-recorded case a no-op here too.
      const clickSoundOptions: ClickSoundOptions | null =
        options.project.cursor.clickSoundEnabled && options.project.clickPath.length > 0
          ? { clickPath: options.project.clickPath, intensity: options.project.cursor.clickBounce }
          : null;
      try {
        await audioProcessor.process(
          sourceFile,
          muxer,
          sourceObjectUrl,
          options.segments,
          exportCodec,
          wasmUrl,
          clickSoundOptions
        );
        audioActuallyProcessed = true;
      } finally {
        signal?.removeEventListener('abort', onAbort);
        URL.revokeObjectURL(sourceObjectUrl);
      }
    }
  }

  if (signal?.aborted) throw new Error(EXPORT_CANCELLED_MESSAGE);

  const blob = await muxer.finalize();
  return { bytes: await blob.arrayBuffer(), includedAudio: audioActuallyProcessed };
}
