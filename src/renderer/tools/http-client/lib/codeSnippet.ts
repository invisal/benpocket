import type { HttpBodyType, HttpMethod } from '../../../../preload/http-client/types';
import type { KeyValueRow } from './keyValueRows';

export type SnippetLanguage = 'curl' | 'javascript-fetch' | 'javascript-axios' | 'python-requests';

export const SNIPPET_LANGUAGES: { value: SnippetLanguage; label: string }[] = [
  { value: 'curl', label: 'cURL' },
  { value: 'javascript-fetch', label: 'JavaScript - Fetch' },
  { value: 'javascript-axios', label: 'JavaScript - Axios' },
  { value: 'python-requests', label: 'Python - Requests' }
];

export interface SnippetInput {
  method: HttpMethod;
  url: string;
  headers: KeyValueRow[];
  bodyType: HttpBodyType;
  body: string;
}

interface ResolvedRequest {
  method: HttpMethod;
  url: string;
  headers: { key: string; value: string }[];
  bodyType: HttpBodyType;
  hasBody: boolean;
  body: string;
}

const NO_BODY_METHODS = new Set<HttpMethod>(['GET', 'HEAD']);

// Mirrors what main/http-client/ipc/http.ts actually sends, so the generated
// snippet matches the real request: body is only included for methods that
// allow one and a non-empty bodyType, and a JSON content-type is only added
// when the user hasn't already set their own Content-Type header.
function resolveRequest(input: SnippetInput): ResolvedRequest {
  const headers = input.headers
    .filter((h) => h.enabled && h.key.trim().length > 0)
    .map((h) => ({ key: h.key, value: h.value }));

  const hasBody =
    !NO_BODY_METHODS.has(input.method) && input.bodyType !== 'none' && input.body.trim().length > 0;

  if (
    hasBody &&
    input.bodyType === 'json' &&
    !headers.some((h) => h.key.toLowerCase() === 'content-type')
  ) {
    headers.push({ key: 'Content-Type', value: 'application/json' });
  }

  return {
    method: input.method,
    url: input.url.trim() || 'https://',
    headers,
    bodyType: input.bodyType,
    hasBody,
    body: input.body
  };
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function pythonSingleQuote(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
  return `'${escaped}'`;
}

/** If `body` is valid JSON, returns it re-serialized as JS object-literal source (JSON is a valid subset); otherwise null. */
function tryJsObjectLiteral(body: string): string | null {
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return null;
  }
}

function generateCurl(req: ResolvedRequest): string {
  const lines = [`curl --location --request ${req.method} ${shellSingleQuote(req.url)}`];
  for (const h of req.headers) {
    lines.push(`--header ${shellSingleQuote(`${h.key}: ${h.value}`)}`);
  }
  if (req.hasBody) {
    lines.push(`--data ${shellSingleQuote(req.body)}`);
  }
  return lines.join(' \\\n  ');
}

function generateJsFetch(req: ResolvedRequest): string {
  const optionLines: string[] = [`  method: ${JSON.stringify(req.method)}`];

  if (req.headers.length > 0) {
    const entries = req.headers
      .map((h) => `    ${JSON.stringify(h.key)}: ${JSON.stringify(h.value)}`)
      .join(',\n');
    optionLines.push(`  headers: {\n${entries}\n  }`);
  }

  if (req.hasBody) {
    const asObject = req.bodyType === 'json' ? tryJsObjectLiteral(req.body) : null;
    optionLines.push(
      asObject ? `  body: JSON.stringify(${asObject})` : `  body: ${JSON.stringify(req.body)}`
    );
  }

  return [
    `fetch(${JSON.stringify(req.url)}, {`,
    optionLines.join(',\n'),
    '})',
    '  .then((response) => response.text())',
    '  .then((result) => console.log(result))',
    '  .catch((error) => console.error(error));'
  ].join('\n');
}

function generateJsAxios(req: ResolvedRequest): string {
  const lines = [
    `const axios = require('axios');`,
    '',
    'const config = {',
    `  method: ${JSON.stringify(req.method)},`,
    `  url: ${JSON.stringify(req.url)}`
  ];

  if (req.headers.length > 0) {
    const entries = req.headers
      .map((h) => `    ${JSON.stringify(h.key)}: ${JSON.stringify(h.value)}`)
      .join(',\n');
    lines[lines.length - 1] += ',';
    lines.push(`  headers: {\n${entries}\n  }`);
  }

  if (req.hasBody) {
    const asObject = req.bodyType === 'json' ? tryJsObjectLiteral(req.body) : null;
    lines[lines.length - 1] += ',';
    lines.push(`  data: ${asObject ?? JSON.stringify(req.body)}`);
  }

  lines.push('};');
  lines.push('');
  lines.push('axios(config)');
  lines.push('  .then((response) => console.log(JSON.stringify(response.data)))');
  lines.push('  .catch((error) => console.log(error));');
  return lines.join('\n');
}

function generatePythonRequests(req: ResolvedRequest): string {
  const lines = ['import requests', '', `url = ${pythonSingleQuote(req.url)}`, ''];

  if (req.headers.length > 0) {
    lines.push('headers = {');
    req.headers.forEach((h, i) => {
      const comma = i < req.headers.length - 1 ? ',' : '';
      lines.push(`  ${pythonSingleQuote(h.key)}: ${pythonSingleQuote(h.value)}${comma}`);
    });
    lines.push('}');
  } else {
    lines.push('headers = {}');
  }

  if (req.hasBody) {
    lines.push(`payload = ${pythonSingleQuote(req.body)}`);
  } else {
    lines.push('payload = {}');
  }

  lines.push('');
  lines.push(
    `response = requests.request(${pythonSingleQuote(req.method)}, url, headers=headers, data=payload)`
  );
  lines.push('');
  lines.push('print(response.text)');
  return lines.join('\n');
}

/** Generates a copy-pasteable code snippet for the current request draft, mirroring Postman's "Code" panel. */
export function generateSnippet(language: SnippetLanguage, input: SnippetInput): string {
  const req = resolveRequest(input);
  switch (language) {
    case 'curl':
      return generateCurl(req);
    case 'javascript-fetch':
      return generateJsFetch(req);
    case 'javascript-axios':
      return generateJsAxios(req);
    case 'python-requests':
      return generatePythonRequests(req);
  }
}
