const HEAP_LOG_INTERVAL_MS = 10_000;

/**
 * Periodic process.memoryUsage() snapshot to the main log -- unlike the
 * one-shot heap logs individual modules (e.g. image-editor) print around
 * their own operations, this catches a leak growing in the background with
 * no operation to pin it to, like the startup-only OOM this was added to
 * chase down.
 */
export function startHeapLogger(intervalMs = HEAP_LOG_INTERVAL_MS): void {
  const start = Date.now();
  setInterval(() => {
    const m = process.memoryUsage();
    const elapsedSec = ((Date.now() - start) / 1000).toFixed(0);
    console.log(
      `[heap] t=${elapsedSec}s`,
      `heapUsed=${(m.heapUsed / 1024 / 1024).toFixed(1)}MB`,
      `heapTotal=${(m.heapTotal / 1024 / 1024).toFixed(1)}MB`,
      `external=${(m.external / 1024 / 1024).toFixed(1)}MB`,
      `arrayBuffers=${(m.arrayBuffers / 1024 / 1024).toFixed(1)}MB`,
      `rss=${(m.rss / 1024 / 1024).toFixed(1)}MB`
    );
  }, intervalMs);
}
