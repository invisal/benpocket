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
