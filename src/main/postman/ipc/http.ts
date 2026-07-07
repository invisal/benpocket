import { ipcMain } from 'electron';
import type { HttpRequestPayload, HttpResponsePayload, KeyValuePair } from '../../../preload/postman/types';

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
        requestUrl = buildRequestUrl(payload.url, payload.params);
        const headers = buildRequestHeaders(payload.headers);

        const methodAllowsBody = !['GET', 'HEAD'].includes(payload.method);
        const hasBody = methodAllowsBody && payload.bodyType !== 'none' && payload.body.trim().length > 0;

        if (hasBody && payload.bodyType === 'json' && !hasHeader(headers, 'content-type')) {
          headers['Content-Type'] = 'application/json';
        }

        const response = await fetch(requestUrl, {
          method: payload.method,
          headers,
          body: hasBody ? payload.body : undefined,
          signal: controller.signal
        });

        const arrayBuffer = await response.arrayBuffer();
        const bodyText = Buffer.from(arrayBuffer).toString('utf-8');
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
          body: bodyText,
          url: requestUrl
        };
      } catch (err) {
        const durationMs = performance.now() - startedAt;
        const isAbort = err instanceof Error && err.name === 'AbortError';
        const message = isAbort
          ? `Request timed out after ${timeoutMs}ms`
          : err instanceof Error
            ? err.message
            : 'Unknown network error';

        return {
          ok: false,
          status: 0,
          statusText: isAbort ? 'Timeout' : 'Network Error',
          headers: {},
          durationMs: Math.round(durationMs),
          sizeBytes: 0,
          body: '',
          url: requestUrl,
          error: message
        };
      } finally {
        clearTimeout(timer);
      }
    }
  );
}
