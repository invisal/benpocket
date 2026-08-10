import type {
  HttpAuth,
  HttpBodyType,
  HttpMethod,
  MultipartField
} from '../../../../preload/http-client/types';

export interface ParsedCurlRequest {
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  bodyType: HttpBodyType;
  body: string;
  multipartFields?: MultipartField[];
  /** Only set when a Basic/Bearer credential was actually found (`-u`, or an Authorization
   * header with a recognized scheme) - callers should leave the tab's existing auth alone
   * otherwise, rather than resetting it to "No Auth" on every paste. */
  auth?: HttpAuth;
}

export function looksLikeCurlCommand(text: string): boolean {
  return /^\s*curl\b/i.test(text);
}

// --- tokenizing ---------------------------------------------------------

// Chrome/Edge DevTools' "Copy as cURL (cmd)" wraps every argument in caret-escaped double
// quotes for cmd.exe (`^"...^"`), and doubly-escapes embedded quotes as `^\^"`, since the
// underlying value itself needs real `\"` once cmd's own escaping is peeled off. A plain
// bash/zsh paste never contains this pattern, so it's a safe detector - stripping every
// `^` + following char unconditionally on an ordinary bash command could otherwise mangle
// a literal caret inside a header/query value.
function looksCmdEscaped(text: string): boolean {
  return /\^"/.test(text) || /\^\r?\n/.test(text);
}

function stripCmdCaretEscaping(text: string): string {
  return text.replace(/\^(.)/g, '$1');
}

/**
 * A pragmatic (not spec-complete) shell-word tokenizer: single quotes are literal,
 * double quotes honor `\"`/`\\`/`\$`/`` \` ``, unquoted `\` escapes the next character
 * except before a newline, where it's a line continuation (bash's `\` + newline, or
 * what's left of cmd's `^` + newline after stripCmdCaretEscaping) and is dropped rather
 * than becoming a literal newline in the token.
 */
function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let hasCurrent = false;
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (hasCurrent) {
        tokens.push(current);
        current = '';
        hasCurrent = false;
      }
      i++;
      continue;
    }

    hasCurrent = true;

    if (ch === "'") {
      i++;
      while (i < n && input[i] !== "'") {
        current += input[i];
        i++;
      }
      i++;
      continue;
    }

    if (ch === '"') {
      i++;
      while (i < n && input[i] !== '"') {
        if (input[i] === '\\' && i + 1 < n && '"\\$`'.includes(input[i + 1])) {
          current += input[i + 1];
          i += 2;
        } else {
          current += input[i];
          i++;
        }
      }
      i++;
      continue;
    }

    if (ch === '\\' && i + 1 < n) {
      if (input[i + 1] === '\n') {
        i += 2;
        continue;
      }
      if (input[i + 1] === '\r' && input[i + 2] === '\n') {
        i += 3;
        continue;
      }
      current += input[i + 1];
      i += 2;
      continue;
    }

    current += ch;
    i++;
  }

  if (hasCurrent) tokens.push(current);
  return tokens;
}

// --- flag table -----------------------------------------------------------

const FLAGS_WITH_VALUE = new Set([
  '-X',
  '--request',
  '-H',
  '--header',
  '-d',
  '--data',
  '--data-raw',
  '--data-binary',
  '--data-ascii',
  '--data-urlencode',
  '-u',
  '--user',
  '-b',
  '--cookie',
  '-e',
  '--referer',
  '-A',
  '--user-agent',
  '-F',
  '--form',
  '--url',
  '-o',
  '--output',
  '-x',
  '--proxy',
  '-m',
  '--max-time',
  '--connect-timeout',
  '--cacert',
  '--cert',
  '--key'
]);

// --- request assembly -------------------------------------------------

function splitHeader(raw: string): { key: string; value: string } | null {
  const idx = raw.indexOf(':');
  if (idx === -1) return null;
  return { key: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
}

function findHeader(
  headers: { key: string; value: string }[],
  name: string
): { key: string; value: string } | undefined {
  return headers.find((h) => h.key.toLowerCase() === name.toLowerCase());
}

function detectBodyType(body: string, contentType: string | undefined): HttpBodyType {
  const ct = contentType?.toLowerCase() ?? '';
  if (ct.includes('application/json')) return 'json';
  if (ct.includes('application/x-www-form-urlencoded')) return 'form';
  if (ct.includes('multipart/form-data')) return 'multipart';
  try {
    JSON.parse(body);
    return 'json';
  } catch {
    // not JSON
  }
  if (/^[^=&\s]+=[^&]*(&[^=&\s]+=[^&]*)*$/.test(body)) return 'form';
  return 'text';
}

function fileNameFromPath(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized.slice(normalized.lastIndexOf('/') + 1) || normalized;
}

/** Parses a pasted `curl ...` command into a fillable request draft. Returns `null` if it
 * doesn't look like a curl command at all, or has no discoverable URL. */
export function parseCurlCommand(rawInput: string): ParsedCurlRequest | null {
  if (!looksLikeCurlCommand(rawInput)) return null;

  const source = looksCmdEscaped(rawInput) ? stripCmdCaretEscaping(rawInput) : rawInput;
  const tokens = tokenize(source);
  if (tokens.length === 0 || tokens[0].toLowerCase() !== 'curl') return null;

  let url: string | undefined;
  let explicitMethod: HttpMethod | undefined;
  const headers: { key: string; value: string }[] = [];
  const dataParts: string[] = [];
  const formFields: { key: string; value: string; isFile: boolean }[] = [];
  let userPass: string | undefined;
  let sawForm = false;
  let sawData = false;

  for (let i = 1; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token.startsWith('-')) {
      // A bare positional argument is the URL, unless --url already set one.
      if (!url) url = token;
      continue;
    }

    const eq = token.indexOf('=');
    const hasInlineValue = token.startsWith('--') && eq !== -1;
    const flag = hasInlineValue ? token.slice(0, eq) : token;
    const takesValue = FLAGS_WITH_VALUE.has(flag);
    const value = hasInlineValue ? token.slice(eq + 1) : takesValue ? tokens[++i] : undefined;

    switch (flag) {
      case '-X':
      case '--request':
        if (value) explicitMethod = value.toUpperCase() as HttpMethod;
        break;
      case '--url':
        if (value) url = value;
        break;
      case '-H':
      case '--header': {
        if (value) {
          const parsed = splitHeader(value);
          if (parsed) headers.push(parsed);
        }
        break;
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
      case '--data-ascii':
      case '--data-urlencode':
        if (value !== undefined) {
          dataParts.push(value);
          sawData = true;
        }
        break;
      case '-u':
      case '--user':
        userPass = value;
        break;
      case '-b':
      case '--cookie':
        if (value) headers.push({ key: 'Cookie', value });
        break;
      case '-e':
      case '--referer':
        if (value) headers.push({ key: 'Referer', value });
        break;
      case '-A':
      case '--user-agent':
        if (value) headers.push({ key: 'User-Agent', value });
        break;
      case '-F':
      case '--form': {
        if (value) {
          const fEq = value.indexOf('=');
          if (fEq !== -1) {
            const key = value.slice(0, fEq);
            let fieldValue = value.slice(fEq + 1);
            const isFile = fieldValue.startsWith('@');
            if (isFile) fieldValue = fieldValue.slice(1).split(';')[0];
            formFields.push({ key, value: fieldValue, isFile });
          }
          sawForm = true;
        }
        break;
      }
      default:
        // Unrecognized flag - assumed boolean (--compressed, -k, -L, -s, -v, ...); if it
        // actually takes a value this drops one token, but none of the flags DevTools'
        // "Copy as cURL" emits fall outside FLAGS_WITH_VALUE above.
        break;
    }
  }

  if (!url) return null;

  const contentTypeHeader = findHeader(headers, 'content-type');
  let bodyType: HttpBodyType = 'none';
  let body = '';
  let multipartFields: MultipartField[] | undefined;

  if (sawForm) {
    bodyType = 'multipart';
    multipartFields = formFields.map((f) =>
      f.isFile
        ? {
            type: 'file' as const,
            key: f.key,
            filePath: f.value,
            fileName: fileNameFromPath(f.value)
          }
        : { type: 'text' as const, key: f.key, value: f.value }
    );
  } else if (sawData) {
    body = dataParts.join('&');
    bodyType = detectBodyType(body, contentTypeHeader?.value);
  }

  const method: HttpMethod = explicitMethod ?? (sawData || sawForm ? 'POST' : 'GET');

  let auth: HttpAuth | undefined;
  if (userPass) {
    const idx = userPass.indexOf(':');
    const username = idx === -1 ? userPass : userPass.slice(0, idx);
    const password = idx === -1 ? '' : userPass.slice(idx + 1);
    auth = { type: 'basic', basic: { username, password } };
  } else {
    const authHeader = findHeader(headers, 'authorization');
    if (authHeader) {
      if (/^Bearer\s+/i.test(authHeader.value)) {
        auth = { type: 'bearer', bearer: { token: authHeader.value.replace(/^Bearer\s+/i, '') } };
        headers.splice(headers.indexOf(authHeader), 1);
      } else if (/^Basic\s+/i.test(authHeader.value)) {
        try {
          const decoded = atob(authHeader.value.replace(/^Basic\s+/i, ''));
          const idx = decoded.indexOf(':');
          auth = {
            type: 'basic',
            basic: {
              username: idx === -1 ? decoded : decoded.slice(0, idx),
              password: idx === -1 ? '' : decoded.slice(idx + 1)
            }
          };
          headers.splice(headers.indexOf(authHeader), 1);
        } catch {
          // Not valid base64 - leave it as a plain header instead of guessing.
        }
      }
    }
  }

  return { method, url, headers, bodyType, body, multipartFields, auth };
}
