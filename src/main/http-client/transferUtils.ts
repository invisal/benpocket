// Small helpers shared by the Postman collection/environment file-export handlers
// (ipc/collectionsTransfer.ts and ipc/environmentsTransfer.ts).

/** Case-insensitive, trimmed match — good enough to pair a collection/environment with "its" counterpart by name. */
export function sameEnvironmentName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function sanitizeFilename(name: string, fallback: string): string {
  return name.replace(/[\\/:*?"<>|]/g, '_').trim() || fallback;
}
