import type {
  HttpAuth,
  HttpBodyType,
  HttpMethod,
  KeyValuePair
} from '../../../../preload/http-client/types';
import type { KeyValueRow } from './keyValueRows';
import { resolveJsonVariables, resolveVariables } from './variables';
import { authToHeader, resolveAuth } from './auth';

export interface AutoHeader {
  key: string;
  value: string;
}

// Kept in sync with the fallback in src/main/http-client/ipc/http.ts - both only
// apply when the user hasn't set Content-Type themselves.
const BODY_CONTENT_TYPES: Partial<Record<HttpBodyType, string>> = {
  json: 'application/json',
  text: 'text/plain',
  form: 'application/x-www-form-urlencoded'
};

// multipart's Content-Type needs the boundary the body was actually built with, which
// (unlike the static types above) varies per-request - recovered from the body's own
// leading "--boundary" line rather than plumbed through as separate state. Preview only:
// the actual request (src/main/http-client/ipc/http.ts) sends multipart as a native
// FormData and lets fetch/undici pick its own boundary, so this is illustrative, not
// byte-exact.
function multipartContentType(body: string): string | undefined {
  const match = /^--(\S+)/.exec(body);
  return match ? `multipart/form-data; boundary=${match[1]}` : undefined;
}

// Kept in sync with DEFAULT_HEADERS in src/main/http-client/ipc/http.ts - sent on
// every request regardless of body.
const DEFAULT_HEADERS: AutoHeader[] = [
  { key: 'User-Agent', value: 'BenPocket-HTTPClient/1.0' },
  { key: 'Accept', value: '*/*' },
  { key: 'Accept-Encoding', value: 'gzip, deflate, br' },
  { key: 'Connection', value: 'keep-alive' }
];

/**
 * Headers the request will carry without appearing as editable rows - shown as
 * "N hidden" headers, derived from the URL/method/body the same way the main
 * process derives them at send time.
 */
export function getAutoHeaders(
  method: HttpMethod,
  url: string,
  bodyType: HttpBodyType,
  body: string,
  headers: KeyValueRow[],
  variables: KeyValuePair[],
  auth: HttpAuth
): AutoHeader[] {
  const explicitKeys = new Set(
    headers.filter((h) => h.enabled && h.key.trim()).map((h) => h.key.trim().toLowerCase())
  );
  const auto: AutoHeader[] = [];

  const authHeader = authToHeader(resolveAuth(auth, variables));
  if (authHeader && !explicitKeys.has(authHeader.key.toLowerCase())) auto.push(authHeader);

  const resolvedUrl = resolveVariables(url, variables);
  try {
    const host = new URL(resolvedUrl).host;
    if (host && !explicitKeys.has('host')) auto.push({ key: 'Host', value: host });
  } catch {
    // Incomplete/invalid URL - nothing to show yet.
  }

  for (const header of DEFAULT_HEADERS) {
    if (!explicitKeys.has(header.key.toLowerCase())) auto.push(header);
  }

  const methodAllowsBody = method !== 'GET' && method !== 'HEAD';
  const resolvedBody =
    bodyType === 'json' ? resolveJsonVariables(body, variables) : resolveVariables(body, variables);
  const hasBody = methodAllowsBody && bodyType !== 'none' && resolvedBody.trim().length > 0;
  if (hasBody) {
    const contentType =
      bodyType === 'multipart' ? multipartContentType(resolvedBody) : BODY_CONTENT_TYPES[bodyType];
    if (contentType && !explicitKeys.has('content-type')) {
      auto.push({ key: 'Content-Type', value: contentType });
    }
    // Skipped for multipart: a file field's placeholder text (its local path) is far
    // shorter than the file's real bytes, so this preview would understate the true
    // length rather than approximate it. The actual request lets fetch/undici compute it.
    if (bodyType !== 'multipart' && !explicitKeys.has('content-length')) {
      auto.push({
        key: 'Content-Length',
        value: String(new TextEncoder().encode(resolvedBody).length)
      });
    }
  }

  return auto;
}
