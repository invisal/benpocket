// Wire shape sent via `window.telemetry.send` / `telemetry:send`. Must stay in sync
// with `EVENT_DEFS` in benpocket-backend's src/routes/telemetry.ts (separate repo,
// no shared code -- match field names/enums by inspection). See docs/telemetry.md
// for the full design and the Event catalog this union mirrors.
export type TelemetryEvent =
  | { event: 'app_opened' }
  | { event: 'tool_opened'; tool: string }
  | {
      event: 'screen-recorder:record';
      durationSec: number;
      sourceType: 'screen' | 'window';
      micEnabled: boolean;
      systemAudioEnabled: boolean;
      webcamEnabled: boolean;
    }
  | {
      event: 'screen-recorder:export';
      format: 'mp4' | 'webm' | 'mov' | 'gif';
      durationSec: number;
      presetId: string;
      clipCount: number;
      hasAnnotations: boolean;
      hasCaptions: boolean;
      hasBlurMask: boolean;
      hasZoom: boolean;
      hasCustomBackground: boolean;
      hasWebcamOverlay: boolean;
    }
  | { event: 'screen-recorder:export_failed' }
  | { event: 'screen-capture:capture' }
  | { event: 'http-client:request' };

/** One event as held in the local queue -- the main process fills in `sessionId`/`ts`
 * on enqueue; `installId`/`appVersion`/`platform` are added once at send time instead
 * of per-event, since they're the same for the whole batch. */
export interface QueuedTelemetryEvent {
  payload: TelemetryEvent;
  sessionId: string;
  ts: number;
}
