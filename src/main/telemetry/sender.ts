import { app } from 'electron';
import { is } from '@electron-toolkit/utils';
import { telemetryStore } from './telemetry-store';

// Same Worker deployment sync uses (see benpocket-backend/wrangler.jsonc's PUBLIC_URL),
// but hardcoded rather than the per-profile `apiBaseUrl` sync relies on -- telemetry
// must keep working for local-only profiles that have no account/profile at all.
const TELEMETRY_API_BASE_URL = 'https://benpocket.com';
const FLUSH_INTERVAL_MS = 45_000;
const QUIT_FLUSH_TIMEOUT_MS = 2_000;

async function flush(): Promise<void> {
  if (is.dev) return; // avoid polluting telemetry with dev-mode noise
  if (!telemetryStore.getOptIn()) return; // no network; the queue is already capped by enqueue()

  const queue = telemetryStore.getQueue();
  if (queue.length === 0) return;

  try {
    const response = await fetch(`${TELEMETRY_API_BASE_URL}/api/telemetry/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        installId: telemetryStore.getOrCreateInstallId(),
        appVersion: app.getVersion(),
        platform: process.platform,
        events: queue.map((q) => ({ ...q.payload, sessionId: q.sessionId, ts: q.ts }))
      })
    });
    if (response.ok) telemetryStore.removeSent(queue.length);
    // Non-2xx: leave the queue as-is, retried on the next tick.
  } catch {
    // Network failure: leave the queue as-is, retried on the next tick.
  }
}

export function startTelemetrySender(): void {
  setInterval(() => void flush(), FLUSH_INTERVAL_MS);
}

/** Best-effort flush bounded to ~2s so shutdown never blocks on a slow/hanging
 * request -- called from `before-quit`. */
export async function flushOnQuit(): Promise<void> {
  await Promise.race([
    flush(),
    new Promise<void>((resolve) => setTimeout(resolve, QUIT_FLUSH_TIMEOUT_MS))
  ]);
}
