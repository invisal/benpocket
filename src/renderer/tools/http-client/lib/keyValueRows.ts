import type { KeyValuePair } from '../../../../preload/http-client/types';
import { makeId } from './makeId';

export interface KeyValueRow extends KeyValuePair {}

export { makeId };

function blankRow(): KeyValueRow {
  return { id: makeId(), key: '', value: '', enabled: true };
}

// Postman-style UX: always keep exactly one trailing empty row ready to type into.
export function withTrailingRow(rows: KeyValueRow[]): KeyValueRow[] {
  const last = rows[rows.length - 1];
  if (!last || last.key.trim() !== '' || last.value.trim() !== '') {
    return [...rows, blankRow()];
  }
  return rows;
}

/**
 * Re-derives rows from a freshly-parsed key/value list (e.g. a URL's query string, or a
 * form/multipart body), reusing existing rows' ids/enabled-state for keys that already
 * existed so the grid doesn't jitter or lose toggles/focus while the user is still typing.
 */
export function mergeRowsFromPairs(
  pairs: { key: string; value: string }[],
  existingRows: KeyValueRow[]
): KeyValueRow[] {
  const pool = new Map<string, KeyValueRow[]>();
  for (const row of existingRows) {
    if (!row.key.trim()) continue;
    const bucket = pool.get(row.key) ?? [];
    bucket.push(row);
    pool.set(row.key, bucket);
  }
  const merged: KeyValueRow[] = pairs.map(({ key, value }) => {
    const bucket = pool.get(key);
    const reused = bucket?.shift();
    return reused ? { ...reused, value } : { id: makeId(), key, value, enabled: true };
  });
  return withTrailingRow(merged);
}
