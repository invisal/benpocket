import { makeId } from './makeId';

export interface BodyPair {
  key: string;
  value: string;
}

// --- application/x-www-form-urlencoded ---

function decodeUrlComponent(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, ' '));
  } catch {
    return raw;
  }
}

export function parseUrlEncodedBody(body: string): BodyPair[] {
  if (!body.trim()) return [];
  return body
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.slice(0, eq);
      const value = eq === -1 ? '' : pair.slice(eq + 1);
      return { key: decodeUrlComponent(key), value: decodeUrlComponent(value) };
    });
}

export function serializeUrlEncodedBody(pairs: BodyPair[]): string {
  return pairs
    .filter((p) => p.key.trim())
    .map((p) => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
    .join('&');
}

// --- multipart/form-data boundary helpers ---
// The row/file-aware multipart parse+serialize live in ./multipartRows.ts - these two
// are shared with it (and with the renderer/main Content-Type preview logic) since a
// multipart body's boundary is recovered from its own leading "--boundary" line rather
// than plumbed through as separate state.

/** A fresh boundary for a new multipart body. Re-serializing after an edit recovers the
 * existing one via `extractMultipartBoundary` instead of calling this again, so it stays
 * stable across keystrokes. */
export function makeMultipartBoundary(): string {
  return `----benpocketFormBoundary${makeId().replace(/-/g, '')}`;
}

export function extractMultipartBoundary(body: string): string | null {
  const match = /^--(\S+)/.exec(body);
  return match ? match[1] : null;
}
