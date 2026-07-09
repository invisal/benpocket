import type { KeyValuePair } from '../../../../preload/http-client/types';
import type { KeyValueRow } from './keyValueRows';

const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

// Substitutes {{name}} placeholders with the active environment's matching
// variable value. Unknown/disabled variables are left untouched (visible as
// literal {{name}}) rather than silently emptied, matching Postman's UX.
export function resolveVariables(text: string, variables: KeyValuePair[]): string {
  if (!text || text.indexOf('{{') === -1) return text;
  const lookup = new Map(
    variables.filter((v) => v.enabled && v.key.trim().length > 0).map((v) => [v.key, v.value])
  );
  return text.replace(VARIABLE_PATTERN, (match, name: string) =>
    lookup.has(name) ? lookup.get(name)! : match
  );
}

export function resolveRows(rows: KeyValueRow[], variables: KeyValuePair[]): KeyValueRow[] {
  return rows.map((row) => ({
    ...row,
    key: resolveVariables(row.key, variables),
    value: resolveVariables(row.value, variables)
  }));
}
