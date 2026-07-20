import type { Project } from '@screen-recorder/types/project';
import type { CursorPathPoint } from '@shared/cursor-path';

/**
 * Message contract between `export-orchestrator.ts` (runs on the hidden
 * export window's own thread, owns the ffmpeg subprocesses) and
 * `render-worker.ts` (runs in a real `Worker` with an `OffscreenCanvas`,
 * owns PixiJS). Both sides live in the *same* OS process (a renderer
 * process), so `postMessage` with a transfer list moves frame buffers with
 * no copy -- unlike a main<->renderer IPC hop, which always copies.
 */
export interface InitWorkerMessage {
  type: 'init';
  canvas: OffscreenCanvas;
  width: number;
  height: number;
}

export interface LoadProjectMessage {
  type: 'load-project';
  project: Project;
  sourceAspect: number;
  smoothedCursorPath: CursorPathPoint[];
}

export interface RenderFrameMessage {
  type: 'render-frame';
  requestId: number;
  atMs: number;
  videoFrame: ArrayBuffer;
  videoFrameWidth: number;
  videoFrameHeight: number;
  webcamFrame?: { buffer: ArrayBuffer; size: number };
}

export type RenderWorkerInMessage = InitWorkerMessage | LoadProjectMessage | RenderFrameMessage;

export interface ReadyMessage {
  type: 'ready';
}

export interface ProjectLoadedMessage {
  type: 'project-loaded';
}

export interface FrameRenderedMessage {
  type: 'frame-rendered';
  requestId: number;
  pixels: ArrayBuffer;
}

export interface WorkerErrorMessage {
  type: 'error';
  requestId?: number;
  message: string;
}

export type RenderWorkerOutMessage =
  ReadyMessage | ProjectLoadedMessage | FrameRenderedMessage | WorkerErrorMessage;
