import type { KeyValuePair } from '../../../../preload/http-client/types';

export interface KeyValueRow extends KeyValuePair {}

export function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

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
