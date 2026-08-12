import { describe, expect, it } from 'vitest';
import { looksLikeCurlCommand, parseCurlCommand } from './curlImport';

describe('looksLikeCurlCommand', () => {
  it('accepts a plain curl command', () => {
    expect(looksLikeCurlCommand('curl https://example.com')).toBe(true);
  });

  it('accepts leading whitespace and is case-insensitive', () => {
    expect(looksLikeCurlCommand('  CURL https://example.com')).toBe(true);
  });

  it('rejects text that does not start with curl', () => {
    expect(looksLikeCurlCommand('wget https://example.com')).toBe(false);
    expect(looksLikeCurlCommand('curlish https://example.com')).toBe(false);
    expect(looksLikeCurlCommand('')).toBe(false);
  });
});

describe('parseCurlCommand', () => {
  it('returns null for non-curl input', () => {
    expect(parseCurlCommand('wget https://example.com')).toBeNull();
  });

  it('returns null when no URL can be found', () => {
    expect(parseCurlCommand('curl -H "Accept: application/json"')).toBeNull();
  });

  it('parses a bare GET request', () => {
    expect(parseCurlCommand('curl https://example.com/api')).toEqual({
      method: 'GET',
      url: 'https://example.com/api',
      headers: [],
      bodyType: 'none',
      body: '',
      multipartFields: undefined,
      auth: undefined
    });
  });

  it('parses --url as the URL even when it appears after other flags', () => {
    const result = parseCurlCommand('curl -X GET --url https://example.com/api');
    expect(result?.url).toBe('https://example.com/api');
    expect(result?.method).toBe('GET');
  });

  it('parses an explicit method and headers', () => {
    const result = parseCurlCommand(
      'curl -X PUT https://example.com/api -H "Accept: application/json" -H "X-Token: abc"'
    );
    expect(result).toEqual({
      method: 'PUT',
      url: 'https://example.com/api',
      headers: [
        { key: 'Accept', value: 'application/json' },
        { key: 'X-Token', value: 'abc' }
      ],
      bodyType: 'none',
      body: '',
      multipartFields: undefined,
      auth: undefined
    });
  });

  it('defaults to POST and detects a JSON body from -d', () => {
    const result = parseCurlCommand(
      `curl https://example.com/api -H "Content-Type: application/json" -d '{"a":1}'`
    );
    expect(result).toEqual({
      method: 'POST',
      url: 'https://example.com/api',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      bodyType: 'json',
      body: '{"a":1}',
      multipartFields: undefined,
      auth: undefined
    });
  });

  it('sniffs a JSON body even without a Content-Type header', () => {
    const result = parseCurlCommand(`curl https://example.com/api -d '{"a":1}'`);
    expect(result?.bodyType).toBe('json');
  });

  it('sniffs a form-urlencoded body when it looks like key=value pairs', () => {
    const result = parseCurlCommand("curl https://example.com/api -d 'a=1&b=2'");
    expect(result?.bodyType).toBe('form');
    expect(result?.body).toBe('a=1&b=2');
  });

  it('falls back to a text body otherwise', () => {
    const result = parseCurlCommand("curl https://example.com/api -d 'just some text'");
    expect(result?.bodyType).toBe('text');
    expect(result?.body).toBe('just some text');
  });

  it('joins repeated -d flags with &', () => {
    const result = parseCurlCommand("curl https://example.com/api -d 'a=1' -d 'b=2'");
    expect(result?.body).toBe('a=1&b=2');
  });

  it('parses --data-raw the same as -d', () => {
    const result = parseCurlCommand("curl https://example.com/api --data-raw 'a=1'");
    expect(result?.bodyType).toBe('form');
    expect(result?.body).toBe('a=1');
  });

  it('parses multipart/form-data fields from -F, including files', () => {
    const result = parseCurlCommand(
      "curl https://example.com/api -F 'name=Ben' -F 'avatar=@/tmp/photo.png'"
    );
    expect(result).toEqual({
      method: 'POST',
      url: 'https://example.com/api',
      headers: [],
      bodyType: 'multipart',
      body: '',
      multipartFields: [
        { type: 'text', key: 'name', value: 'Ben' },
        { type: 'file', key: 'avatar', filePath: '/tmp/photo.png', fileName: 'photo.png' }
      ],
      auth: undefined
    });
  });

  it('strips MIME type suffix from an -F file field', () => {
    const result = parseCurlCommand(
      "curl https://example.com/api -F 'avatar=@/tmp/photo.png;type=image/png'"
    );
    expect(result?.multipartFields).toEqual([
      { type: 'file', key: 'avatar', filePath: '/tmp/photo.png', fileName: 'photo.png' }
    ]);
  });

  it('parses -u into basic auth', () => {
    const result = parseCurlCommand('curl -u alice:secret https://example.com/api');
    expect(result?.auth).toEqual({
      type: 'basic',
      basic: { username: 'alice', password: 'secret' }
    });
  });

  it('treats -u without a password as an empty password', () => {
    const result = parseCurlCommand('curl -u alice https://example.com/api');
    expect(result?.auth).toEqual({ type: 'basic', basic: { username: 'alice', password: '' } });
  });

  it('extracts a Bearer Authorization header into auth and removes the header', () => {
    const result = parseCurlCommand(
      'curl https://example.com/api -H "Authorization: Bearer abc123"'
    );
    expect(result?.auth).toEqual({ type: 'bearer', bearer: { token: 'abc123' } });
    expect(result?.headers).toEqual([]);
  });

  it('extracts a Basic Authorization header into auth and removes the header', () => {
    const credentials = Buffer.from('alice:secret').toString('base64');
    const result = parseCurlCommand(
      `curl https://example.com/api -H "Authorization: Basic ${credentials}"`
    );
    expect(result?.auth).toEqual({
      type: 'basic',
      basic: { username: 'alice', password: 'secret' }
    });
    expect(result?.headers).toEqual([]);
  });

  it('leaves an unparseable Basic Authorization header in place', () => {
    const result = parseCurlCommand(
      'curl https://example.com/api -H "Authorization: Basic not-valid-base64!!"'
    );
    expect(result?.auth).toBeUndefined();
    expect(result?.headers).toEqual([{ key: 'Authorization', value: 'Basic not-valid-base64!!' }]);
  });

  it('leaves an unrecognized Authorization scheme as a plain header', () => {
    const result = parseCurlCommand('curl https://example.com/api -H "Authorization: Digest abc"');
    expect(result?.auth).toBeUndefined();
    expect(result?.headers).toEqual([{ key: 'Authorization', value: 'Digest abc' }]);
  });

  it('prefers -u over an Authorization header when both are present', () => {
    const result = parseCurlCommand(
      'curl -u alice:secret https://example.com/api -H "Authorization: Bearer abc123"'
    );
    expect(result?.auth).toEqual({
      type: 'basic',
      basic: { username: 'alice', password: 'secret' }
    });
    expect(result?.headers).toEqual([{ key: 'Authorization', value: 'Bearer abc123' }]);
  });

  it('ignores unrecognized boolean flags like --compressed and -k', () => {
    const result = parseCurlCommand('curl --compressed -k -L https://example.com/api');
    expect(result?.url).toBe('https://example.com/api');
    expect(result?.method).toBe('GET');
  });

  it('parses --header=value style inline flags', () => {
    const result = parseCurlCommand(
      'curl https://example.com/api --header="Accept: application/json"'
    );
    expect(result?.headers).toEqual([{ key: 'Accept', value: 'application/json' }]);
  });

  it('handles a multi-line command with backslash line continuations', () => {
    const result = parseCurlCommand(
      "curl https://example.com/api \\\n  -H 'Accept: application/json' \\\n  -d 'a=1'"
    );
    expect(result?.headers).toEqual([{ key: 'Accept', value: 'application/json' }]);
    expect(result?.body).toBe('a=1');
  });

  it('unwraps Chrome DevTools "Copy as cURL (cmd)" caret escaping', () => {
    const result = parseCurlCommand(
      'curl ^"https://example.com/api^" ^\n  -H ^"Accept: application/json^"'
    );
    expect(result?.url).toBe('https://example.com/api');
    expect(result?.headers).toEqual([{ key: 'Accept', value: 'application/json' }]);
  });
});
