import Store from 'electron-store';
import type { QueuedTelemetryEvent, TelemetryEvent } from '@shared/telemetry-events';

// Own file (explicit `name`), not the shared `config.json` every other tool's small
// store defaults to -- installId/optIn/toolStats are logically separate from ordinary
// settings.
interface TelemetrySchema {
  installId: string | null;
  optIn: boolean;
  toolStats: Record<string, { count: number; lastUsedAt: number }>;
}

const MAX_QUEUE_SIZE = 500;

/** Single home for all telemetry state (persisted install id/opt-in/stats, plus the
 * in-memory session id and event queue) so callers go through one surface instead of
 * reaching into module-level state directly. */
class Telemetry {
  private readonly store = new Store<TelemetrySchema>({
    name: 'telemetry',
    defaults: {
      installId: null,
      optIn: true, // opt-out, not opt-in
      toolStats: {}
    }
  });

  // One per app launch, in-memory only -- never persisted, never resurrected across
  // restarts -- so events can be grouped per run without wall-clock stitching.
  private readonly sessionId = crypto.randomUUID();

  // In-memory only -- unsent events are lost on quit/crash rather than replayed next
  // launch; flushOnQuit's best-effort send is the only thing standing between a queued
  // event and being dropped.
  private queue: QueuedTelemetryEvent[] = [];

  // In-memory, per launch -- the single source of truth for "has this tool already been
  // reported opened this session," shared by every caller of `telemetry:send`. Used to
  // live as a renderer-side Set in createTabProvider.tsx, keyed off tab activation only;
  // living here instead also covers tools with no tab of their own (e.g. Image Tool,
  // mounted inline in File Explorer's preview panel).
  private readonly openedTools = new Set<string>();

  getOrCreateInstallId(): string {
    const existing = this.store.get('installId');
    if (existing) return existing;

    const installId = crypto.randomUUID();
    this.store.set('installId', installId);
    return installId;
  }

  /** Rotates the install ID and drops any queued events -- no resurrecting old history
   * across an opt-out/opt-in cycle. */
  resetInstallId(): string {
    const installId = crypto.randomUUID();
    this.store.set('installId', installId);
    this.clearQueue();
    return installId;
  }

  getOptIn(): boolean {
    return this.store.get('optIn');
  }

  setOptIn(optIn: boolean): void {
    this.store.set('optIn', optIn);
  }

  getQueue(): QueuedTelemetryEvent[] {
    return this.queue;
  }

  clearQueue(): void {
    this.queue = [];
  }

  /** Removes the first `count` queued events after a successful send -- reads the queue
   * fresh rather than assuming it's unchanged, since `enqueue` can run concurrently
   * while a flush's fetch is in flight. */
  removeSent(count: number): void {
    this.queue = this.queue.slice(count);
  }

  getLocalStats(): Record<string, { count: number; lastUsedAt: number }> {
    return this.store.get('toolStats');
  }

  /** Enqueues one event (capped at MAX_QUEUE_SIZE, drop-oldest on overflow) and, for
   * `tool_opened`, bumps a separate local-only tally that survives a successful flush --
   * the send queue itself is meant to drain once delivered, but a future "most used
   * tools" view still needs real history to read from. A repeat `tool_opened` for a tool
   * already reported this session is dropped before it reaches the queue or the tally. */
  enqueue(payload: TelemetryEvent): void {
    if (payload.event === 'tool_opened') {
      if (this.openedTools.has(payload.tool)) return;
      this.openedTools.add(payload.tool);
    }

    const event: QueuedTelemetryEvent = { payload, sessionId: this.sessionId, ts: Date.now() };
    const updated = [...this.queue, event];
    this.queue =
      updated.length > MAX_QUEUE_SIZE ? updated.slice(updated.length - MAX_QUEUE_SIZE) : updated;

    if (payload.event === 'tool_opened') {
      const toolStats = { ...this.store.get('toolStats') };
      const existing = toolStats[payload.tool];
      toolStats[payload.tool] = { count: (existing?.count ?? 0) + 1, lastUsedAt: event.ts };
      this.store.set('toolStats', toolStats);
    }
  }
}

export const telemetryStore = new Telemetry();
