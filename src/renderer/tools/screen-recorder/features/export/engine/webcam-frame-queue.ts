/**
 * Small producer/consumer queue bridging the webcam `StreamingVideoDecoder`'s
 * callback-push `decodeAll()` to the main video loop's pull-based
 * consumption. Both decoders resample to the same target frame rate (see
 * `streaming-decoder.ts`), so frames naturally arrive in lockstep by index --
 * unlike the reference implementation's timestamp-keyed queue, a plain FIFO
 * is sufficient here.
 */
export class WebcamFrameQueue {
  private readonly pending: VideoFrame[] = [];
  private waiter: ((frame: VideoFrame | null) => void) | null = null;
  private closed = false;
  private failure: Error | null = null;

  push(frame: VideoFrame): void {
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve(frame);
      return;
    }
    this.pending.push(frame);
  }

  close(): void {
    this.closed = true;
    if (this.waiter) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve(null);
    }
  }

  fail(error: Error): void {
    this.failure = error;
    this.close();
  }

  /** Resolves the next frame, or `null` once the producer has closed with nothing left queued. Caller owns the returned frame's lifetime. */
  async next(): Promise<VideoFrame | null> {
    if (this.failure) throw this.failure;
    if (this.pending.length > 0) return this.pending.shift()!;
    if (this.closed) return null;
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  destroy(): void {
    for (const frame of this.pending) frame.close();
    this.pending.length = 0;
    this.close();
  }
}
