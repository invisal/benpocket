/**
 * Shared sentinel for a user-cancelled export, thrown/rejected with this
 * exact message from every cancellation checkpoint (the export Worker, the
 * main-thread audio phase) so callers can distinguish "cancelled" from a
 * real failure without a dedicated message type crossing the Worker
 * boundary.
 */
export const EXPORT_CANCELLED_MESSAGE = 'Export cancelled';

export function isExportCancelled(err: unknown): boolean {
  return err instanceof Error && err.message === EXPORT_CANCELLED_MESSAGE;
}
