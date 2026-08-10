import InpaintWorker from './worker?worker';
import type { InpaintInMessage, InpaintOutMessage } from './types';

export const INPAINT_CANCELLED_MESSAGE = 'inpaint cancelled';

export interface InpaintClientResult {
  rgba: Uint8ClampedArray<ArrayBuffer>;
  width: number;
  height: number;
}

/**
 * Runs one PatchMatch inpaint pass in a dedicated Worker so the multi-scale search never blocks
 * the renderer's main thread. Spawns a fresh Worker per call and terminates it when done, matching
 * the seam-carving/export-coordinator convention this app already uses elsewhere.
 */
export function runInpaint(
  rgba: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  mask: Uint8Array<ArrayBuffer>,
  onProgress: (done: number, total: number) => void,
  signal?: AbortSignal
): Promise<InpaintClientResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error(INPAINT_CANCELLED_MESSAGE));
      return;
    }

    const worker = new InpaintWorker();
    const onAbort = (): void => worker.postMessage({ type: 'cancel' } satisfies InpaintInMessage);
    signal?.addEventListener('abort', onAbort);

    function cleanup(): void {
      signal?.removeEventListener('abort', onAbort);
      worker.terminate();
    }

    worker.onmessage = (event: MessageEvent<InpaintOutMessage>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        onProgress(msg.done, msg.total);
        return;
      }
      if (msg.type === 'cancelled') {
        cleanup();
        reject(new Error(INPAINT_CANCELLED_MESSAGE));
        return;
      }
      if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message));
        return;
      }
      cleanup();
      resolve({
        rgba: new Uint8ClampedArray(msg.rgba),
        width: msg.width,
        height: msg.height
      });
    };
    worker.onerror = (event: ErrorEvent) => {
      cleanup();
      reject(new Error(event.message || 'inpaint worker crashed'));
    };

    // Copy the buffers rather than transferring: the caller's working ImageData still owns them
    // (needed to keep rendering the current image while this run is in flight).
    const rgbaCopy = rgba.slice().buffer;
    const maskCopy = mask.slice().buffer;
    const message: InpaintInMessage = {
      type: 'run',
      rgba: rgbaCopy,
      width,
      height,
      mask: maskCopy
    };
    worker.postMessage(message, [rgbaCopy, maskCopy]);
  });
}
