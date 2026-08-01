/** Generates a unique id via crypto.randomUUID, falling back to a timestamp+random string on environments without it. */
export function makeId(prefix?: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return prefix ? `${prefix}-${uuid}` : uuid;
}
