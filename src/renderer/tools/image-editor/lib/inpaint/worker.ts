/// <reference lib="webworker" />
import { inpaint } from './inpaint';
import type { InpaintInMessage, InpaintOutMessage } from './types';

const worker = self as unknown as DedicatedWorkerGlobalScope;

function post(message: InpaintOutMessage, transfer?: Transferable[]): void {
  if (transfer) worker.postMessage(message, transfer);
  else worker.postMessage(message);
}

// Only one run is ever in flight per Worker instance (the client spawns a fresh Worker per run).
let cancelled = false;

worker.onmessage = async (event: MessageEvent<InpaintInMessage>) => {
  const msg = event.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }

  cancelled = false;
  try {
    const rgba = new Uint8ClampedArray(msg.rgba);
    const mask = new Uint8Array(msg.mask);
    const result = await inpaint(rgba, msg.width, msg.height, mask, {
      onProgress: (done, total) => post({ type: 'progress', done, total }),
      isCancelled: () => cancelled
    });

    if (!result) {
      post({ type: 'cancelled' });
      return;
    }

    post({ type: 'result', rgba: result.rgba.buffer, width: result.width, height: result.height }, [
      result.rgba.buffer
    ]);
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
};
