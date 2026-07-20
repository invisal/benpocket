import type { Project } from '@screen-recorder/types/project';
import type { CursorPathPoint } from '@shared/cursor-path';
import RenderWorker from '../rendering-engine/render-worker?worker';
import type {
  RenderFrameMessage,
  RenderWorkerOutMessage
} from '../rendering-engine/render-worker-protocol';

interface PendingRequest {
  resolve: (pixels: Uint8Array) => void;
  reject: (err: Error) => void;
}

/** How long to wait for the nested Worker to report itself ready/loaded before failing loudly instead of hanging forever -- a crashed/stuck Worker here would otherwise leave the export UI sitting at 0% with no explanation. */
const WORKER_HANDSHAKE_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    );
  });
}

/**
 * Runs on the hidden export window's own thread (see export-orchestrator.ts)
 * and talks to the nested render `Worker` over `postMessage`. Both live in
 * the same OS process, so transferring frame `ArrayBuffer`s here is a real
 * zero-copy handoff -- the thing this whole architecture exists to make
 * possible (see the plan's "one architectural decision" section).
 */
export class RenderWorkerClient {
  private readonly worker: Worker;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private readyReject: ((err: Error) => void) | null = null;
  private readonly readyPromise: Promise<void>;
  private readyResolve!: () => void;
  private projectLoadedResolve: (() => void) | null = null;
  private projectLoadedReject: ((err: Error) => void) | null = null;

  private constructor() {
    this.worker = new RenderWorker();
    this.readyPromise = new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.readyReject = reject;
    });
    this.worker.onmessage = (event: MessageEvent<RenderWorkerOutMessage>) =>
      this.handleMessage(event.data);
    this.worker.onerror = (event: ErrorEvent) => {
      this.failAll(new Error(event.message || 'render worker crashed'));
    };
  }

  static async create(width: number, height: number): Promise<RenderWorkerClient> {
    const client = new RenderWorkerClient();
    const canvas = new OffscreenCanvas(width, height);
    client.worker.postMessage({ type: 'init', canvas, width, height }, [canvas]);
    await withTimeout(
      client.readyPromise,
      WORKER_HANDSHAKE_TIMEOUT_MS,
      'Render worker did not become ready in time (PixiJS renderer init likely failed)'
    );
    return client;
  }

  async loadProject(
    project: Project,
    sourceAspect: number,
    smoothedCursorPath: CursorPathPoint[]
  ): Promise<void> {
    const promise = new Promise<void>((resolve, reject) => {
      this.projectLoadedResolve = resolve;
      this.projectLoadedReject = reject;
    });
    this.worker.postMessage({ type: 'load-project', project, sourceAspect, smoothedCursorPath });
    await withTimeout(
      promise,
      WORKER_HANDSHAKE_TIMEOUT_MS,
      'Render worker did not acknowledge load-project in time'
    );
  }

  renderFrame(
    atMs: number,
    videoFrame: Buffer,
    videoFrameWidth: number,
    videoFrameHeight: number,
    webcamFrame?: { buffer: Buffer; size: number }
  ): Promise<Uint8Array> {
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });

      // `.slice()` (not just `.buffer`) copies into a fresh, unshared
      // ArrayBuffer before transferring -- Node Buffers can share a pooled
      // backing ArrayBuffer, and transferring that directly would neuter
      // memory other Buffers still reference.
      const videoBuffer = videoFrame.buffer.slice(
        videoFrame.byteOffset,
        videoFrame.byteOffset + videoFrame.byteLength
      ) as ArrayBuffer;
      const webcamBuffer = webcamFrame
        ? (webcamFrame.buffer.buffer.slice(
            webcamFrame.buffer.byteOffset,
            webcamFrame.buffer.byteOffset + webcamFrame.buffer.byteLength
          ) as ArrayBuffer)
        : undefined;

      const message: RenderFrameMessage = {
        type: 'render-frame',
        requestId,
        atMs,
        videoFrame: videoBuffer,
        videoFrameWidth,
        videoFrameHeight,
        webcamFrame: webcamBuffer ? { buffer: webcamBuffer, size: webcamFrame!.size } : undefined
      };
      const transfer: Transferable[] = [videoBuffer];
      if (webcamBuffer) transfer.push(webcamBuffer);
      this.worker.postMessage(message, transfer);
    });
  }

  private handleMessage(msg: RenderWorkerOutMessage): void {
    if (msg.type === 'ready') {
      this.readyResolve();
      return;
    }
    if (msg.type === 'project-loaded') {
      this.projectLoadedResolve?.();
      return;
    }
    if (msg.type === 'frame-rendered') {
      const pending = this.pending.get(msg.requestId);
      if (!pending) return;
      this.pending.delete(msg.requestId);
      pending.resolve(new Uint8Array(msg.pixels));
      return;
    }
    // error
    if (msg.requestId !== undefined) {
      const pending = this.pending.get(msg.requestId);
      if (pending) {
        this.pending.delete(msg.requestId);
        pending.reject(new Error(msg.message));
        return;
      }
    }
    // No requestId (or one we don't recognize) -- a fatal init/load-project
    // error, or a request that already timed out. Fail everything currently
    // outstanding rather than leaving it to hang.
    this.failAll(new Error(msg.message));
  }

  /** Rejects every outstanding promise this client is holding -- ready/project-loaded handshakes and any in-flight renderFrame() calls. */
  private failAll(err: Error): void {
    this.readyReject?.(err);
    this.projectLoadedReject?.(err);
    for (const { reject } of this.pending.values()) reject(err);
    this.pending.clear();
  }

  destroy(): void {
    this.worker.terminate();
  }
}
