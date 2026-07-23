import { ipcMain } from 'electron';
import type {
  HttpRequestPayload,
  HttpResponsePayload,
  KeyValuePair
} from '../../../preload/http-client/types';

const DEFAULT_TIMEOUT_MS = 30000;

function enabledPairs(pairs: KeyValuePair[] | undefined): KeyValuePair[] {
  return (pairs ?? []).filter((p) => p.enabled && p.key.trim().length > 0);
}

function buildRequestUrl(rawUrl: string, params: KeyValuePair[] | undefined): string {
  const url = new URL(rawUrl);
  for (const pair of enabledPairs(params)) {
    url.searchParams.set(pair.key, pair.value);
  }
  return url.toString();
}

function buildRequestHeaders(headers: KeyValuePair[] | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of enabledPairs(headers)) {
    result[pair.key] = pair.value;
  }
  return result;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

// Kept in sync with src/renderer/tools/http-client/lib/autoHeaders.ts, which shows
// these same defaults as "hidden" headers in the Headers tab - both only apply
// when the user hasn't set Content-Type themselves.
const BODY_CONTENT_TYPES: Partial<Record<HttpRequestPayload['bodyType'], string>> = {
  json: 'application/json',
  text: 'text/plain',
  form: 'application/x-www-form-urlencoded'
};

// Postman sends these on every request regardless of body, and shows them as
// "hidden" headers in its Headers tab - matched here (and in autoHeaders.ts) so
// the request behaves the same way our UI says it does. Node's own fetch/undici
// already sends its own defaults for these, but they're runtime-dependent (e.g.
// User-Agent: "node"), so they're pinned to fixed values instead of left implicit.
const DEFAULT_HEADERS: Record<string, string> = {
  'User-Agent': 'BenPocket-HTTPClient/1.0',
  Accept: '*/*',
  'Accept-Encoding': 'gzip, deflate, br',
  Connection: 'keep-alive'
};

const NETWORK_ERROR_MESSAGES: Record<string, string> = {
  ENOTFOUND: "Couldn't resolve the host - check the URL is correct.",
  EAI_AGAIN: "Couldn't resolve the host - check the URL is correct.",
  ECONNREFUSED: 'Connection refused - is the server running and reachable at this address?',
  ECONNRESET: 'Connection was reset by the server.',
  ETIMEDOUT: 'Connection timed out.',
  CERT_HAS_EXPIRED: "The server's SSL certificate has expired.",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "Couldn't verify the server's SSL certificate.",
  SELF_SIGNED_CERT_IN_CHAIN: "Couldn't verify the server's SSL certificate."
};

/**
 * fetch()/undici only ever throws a generic "fetch failed" TypeError - the actually
 * useful diagnostic (DNS/connection/TLS error code) lives on `err.cause`. Reads it to
 * produce a message a user can act on instead of an undifferentiated "fetch failed".
 */
function describeNetworkError(err: unknown): string {
  if (err instanceof Error) {
    const cause = err.cause;
    const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : undefined;
    if (typeof code === 'string' && NETWORK_ERROR_MESSAGES[code]) {
      return NETWORK_ERROR_MESSAGES[code];
    }
    return err.message;
  }
  return 'Unknown network error';
}

export function registerHttpHandlers(): void {
  ipcMain.handle(
    'http:send',
    async (_event, payload: HttpRequestPayload): Promise<HttpResponsePayload> => {
      const startedAt = performance.now();
      const timeoutMs = payload.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      let requestUrl = payload.url;

      try {
        try {
          requestUrl = buildRequestUrl(payload.url, payload.params);
        } catch {
          throw new Error('Invalid URL - check the address is complete (e.g. https://...).');
        }
        const headers = buildRequestHeaders(payload.headers);

        for (const [name, value] of Object.entries(DEFAULT_HEADERS)) {
          if (!hasHeader(headers, name)) headers[name] = value;
        }

        const methodAllowsBody = !['GET', 'HEAD'].includes(payload.method);
        const hasBody =
          methodAllowsBody && payload.bodyType !== 'none' && payload.body.trim().length > 0;

        const contentType = hasBody ? BODY_CONTENT_TYPES[payload.bodyType] : undefined;
        if (contentType && !hasHeader(headers, 'content-type')) {
          headers['Content-Type'] = contentType;
        }

        const response = await fetch(requestUrl, {
          method: payload.method,
          headers,
          body: hasBody ? payload.body : undefined,
          signal: controller.signal
        });

        const arrayBuffer = await response.arrayBuffer();
        const bodyBase64 = Buffer.from(arrayBuffer).toString('base64');
        const durationMs = performance.now() - startedAt;

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        return {
          ok: response.ok,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          durationMs: Math.round(durationMs),
          sizeBytes: arrayBuffer.byteLength,
          bodyBase64,
          url: requestUrl
        };
      } catch (err) {
        const durationMs = performance.now() - startedAt;
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const message = isAbort
          ? `Request timed out after ${timeoutMs}ms`
          : describeNetworkError(err);

        return {
          ok: false,
          status: 0,
          statusText: isAbort ? 'Timeout' : 'Network Error',
          headers: {},
          durationMs: Math.round(durationMs),
          sizeBytes: 0,
          bodyBase64: '',
          url: requestUrl,
          error: message
        };
      } finally {
        clearTimeout(timer);
      }
    }
  );
}
