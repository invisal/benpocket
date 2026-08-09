import type React from 'react';
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { parseYaml } from '../lib/formatters/yamlParse';
import { buildTableData, formatCell, summarizeValue, type TableData } from '../lib/tableData';

const TH_CLASS =
  'text-left font-semibold text-zinc-400 px-2 py-1 border-b border-r border-border whitespace-nowrap';
const TD_CLASS = 'px-2 py-1 border-b border-r border-border align-top select-text';

interface ResponseTableProps {
  format: 'json' | 'yaml';
  text: string;
}

/** Table view for JSON/YAML responses: arrays of objects become columns, objects become key/value rows. */
export const ResponseTable: React.FC<ResponseTableProps> = ({ format, text }) => {
  const { data, error } = useMemo(() => {
    try {
      const parsed = format === 'json' ? JSON.parse(text) : parseYaml(text);
      const tableData = buildTableData(parsed);
      return {
        data: tableData,
        error: tableData ? null : 'Value is a single scalar — nothing to show as a table.'
      };
    } catch {
      return { data: null, error: `Could not parse ${format.toUpperCase()} for table view.` };
    }
  }, [format, text]);

  if (!data || error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650 text-xs">
        <AlertTriangle size={20} />
        <span>{error}</span>
      </div>
    );
  }

  if (data.rows.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1.5 text-zinc-650 text-xs">
        <span>Empty {data.kind === 'rows' ? 'array' : 'collection'}.</span>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <TableGrid data={data} />
    </div>
  );
};

/** One level of table markup - used at the top level, and recursively inside a cell whose value expands into a nested table. */
const TableGrid: React.FC<{ data: TableData }> = ({ data }) => {
  if (data.kind === 'rows') {
    return (
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-surface-3 z-10">
          <tr>
            <th className={TH_CLASS}>#</th>
            {data.columns.map((col) => (
              <th key={col} className={TH_CLASS}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="hover:bg-surface-2">
              <td className={`${TD_CLASS} text-zinc-500`}>{i}</td>
              {data.columns.map((col) => (
                <td key={col} className={`${TD_CLASS} text-zinc-200`}>
                  <TableCell value={row[col]} wrap="nowrap" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (data.kind === 'keyValue') {
    return (
      <table className="w-full text-xs border-collapse table-fixed">
        <thead className="sticky top-0 bg-surface-3 z-10">
          <tr>
            <th className={`${TH_CLASS} w-1/3`}>Key</th>
            <th className={TH_CLASS}>Value</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map(([key, value], i) => (
            <tr key={i} className="hover:bg-surface-2">
              <td className={`${TD_CLASS} text-sky-400`}>{key}</td>
              <td className={`${TD_CLASS} text-zinc-200`}>
                <TableCell value={value} wrap="break" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full text-xs border-collapse">
      <thead className="sticky top-0 bg-surface-3 z-10">
        <tr>
          <th className={TH_CLASS}>#</th>
          <th className={TH_CLASS}>Value</th>
        </tr>
      </thead>
      <tbody>
        {data.rows.map((value, i) => (
          <tr key={i} className="hover:bg-surface-2">
            <td className={`${TD_CLASS} text-zinc-500`}>{i}</td>
            <td className={`${TD_CLASS} text-zinc-200`}>
              <TableCell value={value} wrap="break" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

interface TableCellProps {
  value: unknown;
  /** How to wrap plain scalar text - matches the wrapping the flat table used for this column before nesting existed. */
  wrap: 'nowrap' | 'break';
}

/** A single cell's value: scalars render as text; non-empty objects/arrays collapse into a toggle that expands a nested table in place. */
const TableCell: React.FC<TableCellProps> = ({ value, wrap }) => {
  const [expanded, setExpanded] = useState(false);
  const nested = buildTableData(value);

  if (!nested || nested.rows.length === 0) {
    return (
      <span className={wrap === 'nowrap' ? 'whitespace-nowrap' : 'break-all'}>
        {formatCell(value)}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-left font-mono text-zinc-400 hover:text-foreground cursor-pointer"
      >
        {expanded ? (
          <ChevronDown size={10} className="shrink-0" />
        ) : (
          <ChevronRight size={10} className="shrink-0" />
        )}
        {summarizeValue(value)}
      </button>
      {expanded && (
        <div className="border border-border-dark rounded overflow-auto max-h-64 bg-surface">
          <TableGrid data={nested} />
        </div>
      )}
    </div>
  );
};
