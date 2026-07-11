import { looksBinary } from './bytes';

export type ResponseFormat =
  'json' | 'xml' | 'html' | 'yaml' | 'javascript' | 'markdown' | 'raw' | 'hex' | 'base64';

export const RESPONSE_FORMATS: { value: ResponseFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'html', label: 'HTML' },
  { value: 'yaml', label: 'YAML' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'raw', label: 'Raw' },
  { value: 'hex', label: 'Hex' },
  { value: 'base64', label: 'Base64' }
];

function looksLikeHtml(text: string): boolean {
  const head = text.slice(0, 512).toLowerCase();
  return head.includes('<!doctype html') || head.includes('<html');
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || !(trimmed.startsWith('{') || trimmed.startsWith('['))) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function isImageContentType(contentType: string | undefined): boolean {
  return (contentType ?? '').toLowerCase().startsWith('image/');
}

/**
 * Detects the best-guess format for a response: Content-Type first, falling back to
 * sniffing the body when the header is missing or generic (e.g. text/plain).
 */
export function detectFormat(
  contentType: string | undefined,
  text: string,
  bytes: Uint8Array
): ResponseFormat {
  const type = (contentType ?? '').toLowerCase();

  if (type.includes('json')) return 'json';
  if (type.includes('xml')) return 'xml';
  if (type.includes('html')) return 'html';
  if (type.includes('yaml')) return 'yaml';
  if (type.includes('javascript') || type.includes('ecmascript')) return 'javascript';
  if (type.includes('markdown')) return 'markdown';

  if (looksLikeJson(text)) return 'json';
  if (text.trimStart().startsWith('<')) return looksLikeHtml(text) ? 'html' : 'xml';
  if (looksBinary(bytes)) return 'hex';
  return 'raw';
}
