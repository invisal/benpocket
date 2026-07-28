import type { HttpAuth, HttpAuthType, KeyValuePair } from '../../../../preload/http-client/types';
import { resolveVariables } from './variables';

export const DEFAULT_HTTP_AUTH: HttpAuth = { type: 'noauth' };

export const AUTH_TYPE_OPTIONS: { value: HttpAuthType; label: string }[] = [
  { value: 'noauth', label: 'No Auth' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apikey', label: 'API Key' }
];

export function authTypeLabel(type: HttpAuthType): string {
  return AUTH_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

/** Substitutes `{{var}}` in the auth fields, mirroring how headers/params/body are resolved before sending. */
export function resolveAuth(auth: HttpAuth | undefined, variables: KeyValuePair[]): HttpAuth {
  if (!auth) return DEFAULT_HTTP_AUTH;
  switch (auth.type) {
    case 'bearer':
      return {
        type: 'bearer',
        bearer: { token: resolveVariables(auth.bearer?.token ?? '', variables) }
      };
    case 'basic':
      return {
        type: 'basic',
        basic: {
          username: resolveVariables(auth.basic?.username ?? '', variables),
          password: resolveVariables(auth.basic?.password ?? '', variables)
        }
      };
    case 'apikey':
      return {
        type: 'apikey',
        apikey: {
          key: resolveVariables(auth.apikey?.key ?? '', variables),
          value: resolveVariables(auth.apikey?.value ?? '', variables),
          in: auth.apikey?.in ?? 'header'
        }
      };
    default:
      return DEFAULT_HTTP_AUTH;
  }
}

/**
 * The header a resolved (variables already substituted) auth resolves to - what Postman
 * shows greyed-out under Authorization. Kept in sync with the header-injection logic in
 * src/main/http-client/ipc/http.ts. An 'apikey' auth placed in the query string has no
 * header to preview here.
 */
export function authToHeader(auth: HttpAuth): { key: string; value: string } | null {
  switch (auth.type) {
    case 'bearer':
      return auth.bearer?.token
        ? { key: 'Authorization', value: `Bearer ${auth.bearer.token}` }
        : null;
    case 'basic': {
      const username = auth.basic?.username ?? '';
      const password = auth.basic?.password ?? '';
      if (!username && !password) return null;
      return { key: 'Authorization', value: `Basic ${btoa(`${username}:${password}`)}` };
    }
    case 'apikey':
      if (!auth.apikey?.key || auth.apikey.in === 'query') return null;
      return { key: auth.apikey.key, value: auth.apikey.value ?? '' };
    default:
      return null;
  }
}
