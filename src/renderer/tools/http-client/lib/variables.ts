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

const JSON_VARIABLE_PATTERN = /("?)\{\{\s*([\w.-]+)\s*\}\}("?)/g;

function isValidJsonLiteral(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Same substitution as resolveVariables, but JSON-aware: imported Postman collections
 * often template a JSON body like `"username": {{username}}` (no quotes around the
 * placeholder), expecting the variable to become a quoted string. Plain substitution
 * there would paste the raw value in unquoted and produce invalid JSON. Quoted
 * placeholders (`"username": "{{username}}"`) and values that are already valid JSON
 * on their own (numbers, booleans, null, objects, arrays) are left exactly as typed.
 */
export function resolveJsonVariables(text: string, variables: KeyValuePair[]): string {
  if (!text || text.indexOf('{{') === -1) return text;
  const lookup = new Map(
    variables.filter((v) => v.enabled && v.key.trim().length > 0).map((v) => [v.key, v.value])
  );
  return text.replace(
    JSON_VARIABLE_PATTERN,
    (match, openQuote: string, name: string, closeQuote: string) => {
      if (!lookup.has(name)) return match;
      const value = lookup.get(name)!;
      if (openQuote && closeQuote) return `${openQuote}${value}${closeQuote}`;
      return isValidJsonLiteral(value) ? value : JSON.stringify(value);
    }
  );
}
