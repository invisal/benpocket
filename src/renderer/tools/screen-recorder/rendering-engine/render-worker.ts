/// <reference lib="webworker" />
import { DOMAdapter, WebWorkerAdapter } from 'pixi.js';
import type { Project } from '@screen-recorder/types/project';
import type { CursorPathPoint } from '@shared/cursor-path';
import { evaluateSceneAtMs } from './timeline-evaluator';
import { PixiSceneRenderer } from './pixi-scene-renderer';
import type { RenderWorkerInMessage, RenderWorkerOutMessage } from './render-worker-protocol';

// PixiJS defaults to `BrowserAdapter`, which assumes `document` exists (used
// e.g. by BlurFilter's shader-precision detection, `getTestContext()`) --
// true on a normal page, but this module runs inside a real `Worker`, which
// has no DOM at all. `WebWorkerAdapter` is Pixi's own official worker-safe
// adapter (`createCanvas` -> `OffscreenCanvas` instead of
// `document.createElement`), it just isn't selected automatically. Must run
// before any PixiJS rendering code executes -- see PixiSceneRenderer.create().
DOMAdapter.set(WebWorkerAdapter);

const worker = self as unknown as DedicatedWorkerGlobalScope;

let renderer: PixiSceneRenderer | null = null;
let outputWidth = 0;
let outputHeight = 0;
let project: Project | null = null;
let sourceAspect = 16 / 9;
let smoothedCursorPath: CursorPathPoint[] = [];

function post(message: RenderWorkerOutMessage, transfer: Transferable[] = []): void {
  worker.postMessage(message, transfer);
}

worker.onmessage = async (event: MessageEvent<RenderWorkerInMessage>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case 'init': {
        outputWidth = msg.width;
        outputHeight = msg.height;
        renderer = await PixiSceneRenderer.create(msg.canvas, msg.width, msg.height);
        post({ type: 'ready' });
        break;
      }
      case 'load-project': {
        project = msg.project;
        sourceAspect = msg.sourceAspect;
        smoothedCursorPath = msg.smoothedCursorPath;
        post({ type: 'project-loaded' });
        break;
      }
      case 'render-frame': {
        if (!renderer || !project) {
          throw new Error('render-frame received before init/load-project');
        }
        const scene = evaluateSceneAtMs(
          project,
          msg.atMs,
          outputWidth,
          outputHeight,
          sourceAspect,
          smoothedCursorPath
        );
        const videoFrame = new Uint8Array(msg.videoFrame);
        const webcamFrame = msg.webcamFrame
          ? { buffer: new Uint8Array(msg.webcamFrame.buffer), size: msg.webcamFrame.size }
          : undefined;
        const pixels = await renderer.renderFrame(
          scene,
          videoFrame,
          msg.videoFrameWidth,
          msg.videoFrameHeight,
          webcamFrame
        );
        const pixelsBuffer = pixels.buffer as ArrayBuffer;
        post({ type: 'frame-rendered', requestId: msg.requestId, pixels: pixelsBuffer }, [
          pixelsBuffer
        ]);
        break;
      }
    }
  } catch (err) {
    // Full error (with stack) goes to the console for diagnosis; the
    // message that actually propagates up to the export UI on failure stays
    // just the message, not a raw stack trace.
    console.error('[render-worker]', msg.type, err);
    post({
      type: 'error',
      requestId: msg.type === 'render-frame' ? msg.requestId : undefined,
      message: err instanceof Error ? err.message : String(err)
    });
  }
};
