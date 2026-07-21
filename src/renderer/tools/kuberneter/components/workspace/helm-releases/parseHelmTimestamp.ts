/**
 * Helm's `list -o json` emits the `updated` field as a Go time string, e.g.
 * "2026-07-20 22:52:00.123456 +0700 +07". `new Date()` chokes on the trailing
 * zone name, so normalize it into an ISO-ish string the Date constructor accepts.
 * Returns the original value if it doesn't match the expected shape.
 */
export function parseHelmTimestamp(updated: string): string {
  if (!updated) return updated;
  const match = updated.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.\d+)? ([+-]\d{4})/);
  if (!match) return updated;
  const [, date, time, offset] = match;
  return `${date}T${time}${offset}`;
}
