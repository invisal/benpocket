export type TableData =
  | { kind: 'rows'; columns: string[]; rows: Array<Record<string, unknown>> }
  | { kind: 'keyValue'; rows: Array<[string, unknown]> }
  | { kind: 'list'; rows: unknown[] };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Shapes a parsed JSON/YAML value into a table-friendly structure, or null for scalars. */
export function buildTableData(value: unknown): TableData | null {
  if (Array.isArray(value)) {
    if (value.length > 0 && value.every(isPlainObject)) {
      const columns: string[] = [];
      const seen = new Set<string>();
      for (const item of value as Record<string, unknown>[]) {
        for (const key of Object.keys(item)) {
          if (!seen.has(key)) {
            seen.add(key);
            columns.push(key);
          }
        }
      }
      return { kind: 'rows', columns, rows: value as Record<string, unknown>[] };
    }
    return { kind: 'list', rows: value };
  }

  if (isPlainObject(value)) {
    return { kind: 'keyValue', rows: Object.entries(value) };
  }

  return null;
}

/** Renders a cell value as display text: primitives as-is, objects/arrays as compact JSON. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** True when a cell value has nested data worth drilling into as a sub-table. */
export function isExpandableCell(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.length > 0;
  return Object.keys(value).length > 0;
}

/** Short label shown for an expandable cell before it's opened, e.g. "Array(3)" or "Object". */
export function cellLabel(value: unknown): string {
  return Array.isArray(value) ? `Array(${value.length})` : 'Object';
}
