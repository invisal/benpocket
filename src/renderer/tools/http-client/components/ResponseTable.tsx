import type React from 'react';
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { parseYaml } from '../lib/formatters/yamlParse';
import { buildTableData, cellLabel, formatCell, isExpandableCell } from '../lib/tableData';
import type { TableData } from '../lib/tableData';

const TH_CLASS =
  'text-left font-semibold text-zinc-400 px-2 py-1 border-b border-r border-border whitespace-nowrap';
const TD_CLASS = 'px-2 py-1 border-b border-r border-border select-text align-top';

interface ResponseTableProps {
  format: 'json' | 'yaml';
  text: string;
}

/** Renders a single cell: primitives as text, nested objects/arrays as an expandable sub-table. */
const TableCell: React.FC<{ value: unknown }> = ({ value }) => {
  const [expanded, setExpanded] = useState(false);
  const nested = useMemo(() => (isExpandableCell(value) ? buildTableData(value) : null), [value]);

  if (!nested) {
    return <span className="whitespace-nowrap">{formatCell(value)}</span>;
  }

  return (
    <div>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1 text-amber-400 hover:text-amber-300 cursor-pointer font-medium whitespace-nowrap"
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        {cellLabel(value)}
      </button>
      {expanded && (
        <div className="mt-1 border border-border-dark rounded overflow-auto max-h-72 max-w-[480px]">
          <DataTable data={nested} />
        </div>
      )}
    </div>
  );
};

/** Renders a TableData shape as a table, using TableCell for values so nested data can expand recursively. */
const DataTable: React.FC<{ data: TableData }> = ({ data }) => {
  if (data.rows.length === 0) {
    return (
      <div className="p-2 text-zinc-650 text-xs">
        Empty {data.kind === 'rows' ? 'array' : 'collection'}.
      </div>
    );
  }

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
                  <TableCell value={row[col]} />
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
              <td className={`${TD_CLASS} text-zinc-200 break-all`}>
                <TableCell value={value} />
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
            <td className={`${TD_CLASS} text-zinc-200 break-all`}>
              <TableCell value={value} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

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

  return (
    <div className="h-full overflow-auto">
      <DataTable data={data} />
    </div>
  );
};
