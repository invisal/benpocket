import type { HttpBodyType, HttpMethod, KeyValuePair } from '../../../../preload/http-client/types';
import type { KeyValueRow } from './keyValueRows';
import { resolveJsonVariables, resolveVariables } from './variables';

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

// Kept in sync with DEFAULT_HEADERS in src/main/http-client/ipc/http.ts - sent on
// every request regardless of body, same as Postman's own "hidden" defaults.
const DEFAULT_HEADERS: AutoHeader[] = [
  { key: 'User-Agent', value: 'BenPocket-HTTPClient/1.0' },
  { key: 'Accept', value: '*/*' },
  { key: 'Accept-Encoding', value: 'gzip, deflate, br' },
  { key: 'Connection', value: 'keep-alive' }
];

/**
 * Headers the request will carry without appearing as editable rows - Postman-style
 * "N hidden" headers, derived from the URL/method/body the same way the main
 * process derives them at send time.
 */
export function getAutoHeaders(
  method: HttpMethod,
  url: string,
  bodyType: HttpBodyType,
  body: string,
  headers: KeyValueRow[],
  variables: KeyValuePair[]
): AutoHeader[] {
  const explicitKeys = new Set(
    headers.filter((h) => h.enabled && h.key.trim()).map((h) => h.key.trim().toLowerCase())
  );
  const auto: AutoHeader[] = [];

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
    const contentType = BODY_CONTENT_TYPES[bodyType];
    if (contentType && !explicitKeys.has('content-type')) {
      auto.push({ key: 'Content-Type', value: contentType });
    }
    if (!explicitKeys.has('content-length')) {
      auto.push({
        key: 'Content-Length',
        value: String(new TextEncoder().encode(resolvedBody).length)
      });
    }
  }

  return auto;
}
