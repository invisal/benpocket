import type { MultipartField } from '../../../../preload/http-client/types';
import { extractMultipartBoundary, makeMultipartBoundary } from './formBody';
import { makeId } from './makeId';

export type MultipartFieldType = 'text' | 'file';

export interface MultipartRow {
  id: string;
  key: string;
  enabled: boolean;
  fieldType: MultipartFieldType;
  /** Used when fieldType is 'text'. */
  value: string;
  /** Used when fieldType is 'file' - set once the user has picked one via the file dialog. */
  file?: { filePath: string; fileName: string; size: number };
}

function blankMultipartRow(): MultipartRow {
  return { id: makeId(), key: '', enabled: true, fieldType: 'text', value: '' };
}

function isBlank(row: MultipartRow): boolean {
  return row.key.trim() === '' && row.fieldType === 'text' && row.value.trim() === '';
}

// Postman-style UX: always keep exactly one trailing empty row ready to type into.
export function withTrailingMultipartRow(rows: MultipartRow[]): MultipartRow[] {
  const last = rows[rows.length - 1];
  if (!last || !isBlank(last)) return [...rows, blankMultipartRow()];
  return rows;
}

/**
 * One-time hydration from a saved/imported body string into row form - used only when no
 * live row state exists yet (fresh tab, loaded seed, or state persisted before this field
 * existed). Never used to re-derive rows after every edit, unlike the plain key/value
 * editors: a file row's local disk path can't be recovered by re-parsing the wire text
 * alone in a way that would preserve identity across keystrokes, so edits mutate
 * `MultipartRow[]` directly instead (see useHttp.ts's updateMultipartRow).
 */
export function parseMultipartRows(body: string): MultipartRow[] {
  const boundary = extractMultipartBoundary(body);
  if (!boundary) return [];
  const marker = `--${boundary}`;
  const segments = body.split(marker).slice(1, -1);
  const rows: MultipartRow[] = [];
  for (const segment of segments) {
    const content = segment.replace(/^\r?\n/, '');
    const headerEnd = content.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;
    const headerBlock = content.slice(0, headerEnd);
    const nameMatch = /name="([^"]*)"/.exec(headerBlock);
    if (!nameMatch) continue;
    const value = content.slice(headerEnd + 4).replace(/\r\n$/, '');
    const filenameMatch = /filename="([^"]*)"/.exec(headerBlock);
    if (filenameMatch) {
      // The placeholder body holds the file's absolute path (see serializeMultipartRows) -
      // size isn't recoverable without re-stat'ing, so it's left at 0 until re-picked.
      rows.push({
        id: makeId(),
        key: nameMatch[1],
        enabled: true,
        fieldType: 'file',
        value: '',
        file: { filePath: value, fileName: filenameMatch[1], size: 0 }
      });
    } else {
      rows.push({ id: makeId(), key: nameMatch[1], enabled: true, fieldType: 'text', value });
    }
  }
  return rows;
}

/**
 * Rebuilds the raw `body` string from rows for saving/exporting/preview. A file row's
 * "value" is its local file path, standing in for content this text-only format can't
 * carry - real bytes are only read (from `file.filePath`) at actual send time, via the
 * structured `toMultipartFields` payload sent alongside `body` (see useHttp.ts's send()).
 */
export function serializeMultipartRows(rows: MultipartRow[], prevBody: string): string {
  const active = rows.filter((r) => r.enabled && r.key.trim());
  if (active.length === 0) return '';
  const boundary = extractMultipartBoundary(prevBody) ?? makeMultipartBoundary();
  const parts = active.map((r) => {
    if (r.fieldType === 'file' && r.file) {
      return `--${boundary}\r\nContent-Disposition: form-data; name="${r.key}"; filename="${r.file.fileName}"\r\n\r\n${r.file.filePath}`;
    }
    return `--${boundary}\r\nContent-Disposition: form-data; name="${r.key}"\r\n\r\n${r.value}`;
  });
  return `${parts.join('\r\n')}\r\n--${boundary}--`;
}

/** Rows -> the structured field list actually sent over IPC for a multipart send (see
 * HttpRequestPayload.multipartFields) - `resolveKeyValue` resolves `{{var}}` in
 * key/text-value pairs the same way headers/params rows are resolved before sending. */
export function toMultipartFields(
  rows: MultipartRow[],
  resolveKeyValue: (key: string, value: string) => { key: string; value: string }
): MultipartField[] {
  const fields: MultipartField[] = [];
  for (const row of rows) {
    if (!row.enabled || !row.key.trim()) continue;
    if (row.fieldType === 'file') {
      if (!row.file) continue;
      const { key } = resolveKeyValue(row.key, '');
      fields.push({ type: 'file', key, filePath: row.file.filePath, fileName: row.file.fileName });
    } else {
      const { key, value } = resolveKeyValue(row.key, row.value);
      fields.push({ type: 'text', key, value });
    }
  }
  return fields;
}
