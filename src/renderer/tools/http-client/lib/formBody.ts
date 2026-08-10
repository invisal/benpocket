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

// --- multipart/form-data ---
// Text fields only - there's no file-picker/binary plumbing in this client yet, so a
// part with a `filename=` (as Postman-imported formdata may have) is dropped rather
// than faked.

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

export function parseMultipartBody(body: string): BodyPair[] {
  const boundary = extractMultipartBoundary(body);
  if (!boundary) return [];
  const marker = `--${boundary}`;
  const segments = body.split(marker).slice(1, -1);
  const result: BodyPair[] = [];
  for (const segment of segments) {
    const content = segment.replace(/^\r?\n/, '');
    const headerEnd = content.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerBlock = content.slice(0, headerEnd);
    if (/filename="/.test(headerBlock)) continue;
    const nameMatch = /name="([^"]*)"/.exec(headerBlock);
    if (!nameMatch) continue;
    const value = content.slice(headerEnd + 4).replace(/\r\n$/, '');
    result.push({ key: nameMatch[1], value });
  }
  return result;
}

export function serializeMultipartBody(pairs: BodyPair[], boundary: string): string {
  const enabled = pairs.filter((p) => p.key.trim());
  if (enabled.length === 0) return '';
  const parts = enabled.map(
    (p) => `--${boundary}\r\nContent-Disposition: form-data; name="${p.key}"\r\n\r\n${p.value}`
  );
  return `${parts.join('\r\n')}\r\n--${boundary}--`;
}
