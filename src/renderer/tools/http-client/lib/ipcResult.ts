import type { WsAckResult } from '../../../../preload/http-client/types';

/** Throws with the server's error message when a mutation IPC call fails, so callers can surface it. */
export function assertOk(result: WsAckResult): void {
  if (!result.ok) throw new Error(result.error ?? 'Something went wrong.');
}
